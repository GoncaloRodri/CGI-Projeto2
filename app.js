import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";

import { ortho, flatten, vec3,lookAt} from "../../libs/MV.js";

import { modelView, loadMatrix, multRotationY, multRotationZ, multScale, multRotationX, multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";

import * as dat from "../../libs/dat.gui.module.js";

import * as SPHERE from '../../libs/objects/sphere.js';

import * as CYLINDER from '../../libs/objects/cylinder.js';

import * as CUBE from '../../libs/objects/cube.js';

import * as PYRAMID from '../../libs/objects/pyramid.js';

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1 / 60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

let trees = []; 

const VP_DISTANCE = 50;

const ACELARATION = 1.2;
const DECELARATION = 1.1;
const MAX_VELOCITY = 1;
const BLADE_SPEED = 10;
const MAX_HEIGHT = 40;
const HEIGHT_RATIO = 0.5;
const MAX_BLADE_SPEED = 300;
const MAX_TILT = 30;
const STARTING_HEIGHT = 10;
const MOV_RAD = 30;
const STARTING_POSITION = 90;
const BOX_LIFETIME = 5;
const DEGRE2RAD = Math.PI * 2 / 360;
const X_AXONOMETRIC = 40.0;
const Y_AXONOMETRIC = 45.0;
const X_FRONT_VIEW = 0.0;
const Y_FRONT_VIEW = 0.0;
const X_SIDE_VIEW = 0.0;
const Y_SIDE_VIEW = 90.0;
const X_TOP_VIEW = 90.0;
const Y_TOP_VIEW = 0.0;
const BOX_INIT_VEL_Y = 0.1;
const view_options = {
        Axonometric_View: "axo",
        Front_View: "front",
        Side_View: "side",
        Top_View: "top"
};

const MIN_THETA = 0;
const MAX_THETA = 360;
const THETA_STEP = 1;

const MIN_GAMMA = 0;
const MAX_GAMMA = 90;
const GAMMA_STEP = 1; 

let camController=  {
    gamma: X_AXONOMETRIC,
    theta: Y_AXONOMETRIC,
    view: view_options.Axonometric_View,
};

let bladesSpeed = BLADE_SPEED;
let angle = STARTING_POSITION;
let distancey = STARTING_HEIGHT;
let velocity = 0;
let breaking = false;
let heli_tilt = 0;
let blade_angle = 0;
let lastVelocity = velocity;
let boxes = [];

function setup(shaders) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);
    
    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE * aspect, VP_DISTANCE * aspect, -VP_DISTANCE, VP_DISTANCE, -3 * VP_DISTANCE, 3 * VP_DISTANCE);

    mode = gl.TRIANGLES;

    resize_canvas();

    //Initialize the dat.gui camera controler
    function init_cam_control() {

        const gui = new dat.GUI();
    
        let folder;
        folder = gui.addFolder('Controls');
        folder.add(camController, 'gamma', MIN_GAMMA, MAX_GAMMA, GAMMA_STEP);
        folder.add(camController, 'theta', MIN_THETA, MAX_THETA, THETA_STEP);
        folder.add(camController, 'view', view_options).onChange(() => updateView());
        }
    
    init_cam_control();


    function updateView(){
        switch(camController.view){
            case "axo":
                setAxonometricView();
                break;
            case "front":
                setFrontView();
                break;
            case "side":
                setSideView();
                break;
            case "top":
                setTopView();
                break;
        }
    }

    window.addEventListener("resize", resize_canvas);

    //sets the gamma and theta values to the axonometric view values
    function setAxonometricView(){
        
        camController.gamma = X_AXONOMETRIC;
        camController.theta = Y_AXONOMETRIC;
    }

    //sets the gamma and theta values to the side view values
    function setSideView(){
        camController.gamma = X_SIDE_VIEW;
        camController.theta = Y_SIDE_VIEW;
    }

    //sets the gamma and theta values to the front view values
    function setFrontView(){
        camController.gamma = X_FRONT_VIEW;
        camController.theta = Y_FRONT_VIEW;      
    }

    //sets the gamma and theta values to the top view values
    function setTopView(){
        camController.gamma = X_TOP_VIEW;
        camController.theta = Y_TOP_VIEW;
    }

    document.onkeydown = function (event) {
        switch (event.key) {

            case 'w':
                mode = gl.LINES;
                break;
            case 's':
                mode = gl.TRIANGLES;
                break;
            case 'p':
                animation = !animation;
                break;  
            case '1':
                setAxonometricView();
                break;
            case '2':
                setFrontView();
                break;
            case '3':
                setSideView();
                break;
            case '4':
                setTopView();
                break;
            case ' ':
                boxes.push([distancey , time + BOX_LIFETIME, angle, velocity, BOX_INIT_VEL_Y]);
                break;
            case 'ArrowUp':
                if (distancey < MAX_HEIGHT)
                    distancey += HEIGHT_RATIO;
                break;
            case 'ArrowDown':
                if (distancey >= HEIGHT_RATIO)
                    distancey -= HEIGHT_RATIO;
                break;
            case 'ArrowLeft':
                if (velocity <= MAX_VELOCITY && distancey > 0){
                    breaking = false;
                    if (velocity <= 0) velocity = 0.1;
                    if (velocity*ACELARATION > MAX_VELOCITY) 
                        velocity = MAX_VELOCITY;
                    else
                        velocity *= ACELARATION;
                }
                break;
        }
    }

    document.onkeyup = function(event) {
        if (event.key === "ArrowLeft")
            breaking = true;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CYLINDER.init(gl);
    CUBE.init(gl);
    PYRAMID.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    window.requestAnimationFrame(render);


    function resize_canvas(event) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
        mProjection = ortho(-VP_DISTANCE * aspect, VP_DISTANCE * aspect, -VP_DISTANCE, VP_DISTANCE, -3 * VP_DISTANCE, 3 * VP_DISTANCE);
    }

    function uploadModelView() {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function buildingsColors() {
        let yellow1 = vec3(0.4,0.4,0.4);    
        let yellow2 = vec3(0.5,0.5,0.5);   
        let yellow3 = vec3(0.66,0.66,0.66);      
        let yellow4 = vec3(0.98,0.92,0.59);
        let yellow5 = vec3(0.1,0,0.9);
        let yellow6 = vec3(0.5,0.9,0.9);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        const uColor4 = gl.getUniformLocation(program, "uColor4");
        const uColor5 = gl.getUniformLocation(program, "uColor5");
        const uColor6 = gl.getUniformLocation(program, "uColor6");
        gl.uniform3fv(uColor1, yellow1);
        gl.uniform3fv(uColor2, yellow2);
        gl.uniform3fv(uColor3, yellow3);
        gl.uniform3fv(uColor4, yellow4);
        gl.uniform3fv(uColor5, yellow5);
        gl.uniform3fv(uColor6, yellow6);
    }

    function buildingParts() {
        buildingsColors();
        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function windowUnit() {
        let yellow1 = vec3(0.94,0.9,0.55);
        gl.useProgram(program);
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        gl.uniform3fv(uColor2, yellow1);
        gl.uniform3fv(uColor3, yellow1);
        multScale([2,2,1]);
        uploadModelView();
        CUBE.draw(gl, program, mode);
    }

    function windowRowBig() {
        pushMatrix();
            multTranslation([4.5,0,0]);
            multScale([1,1,15.25]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multTranslation([2,0,0]);
            multScale([1,1,15.25]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multTranslation([-2,0,0]);
            multScale([1,1,15.25]);
            windowUnit();
        popMatrix();
        multTranslation([-4.5,0,0]);
        multScale([1,1,15.25]);
        windowUnit();
    }

    function windowsBig() {
        pushMatrix();
            multTranslation([0,12,0]);
            windowRowBig();
        popMatrix();        
        pushMatrix();
            multTranslation([0,9,0]);
            windowRowBig();
        popMatrix();
        pushMatrix();
            multTranslation([0,6,0]);
            windowRowBig();
        popMatrix();
        pushMatrix();
            multTranslation([0,3,0]);
            windowRowBig();
        popMatrix();
        pushMatrix();
            multTranslation([0,0,0]);
            windowRowBig();
        popMatrix();
        pushMatrix();
            multTranslation([0,-3,0]);
            windowRowBig();
        popMatrix();
        multTranslation([0,-6,0]);
        windowRowBig();
    }

    function windowRowMedium() {
        pushMatrix();
            multTranslation([3,17,0]);
            multScale([1,1,10.10]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multTranslation([-0.05,17,0]);
            multScale([1,1,10.10]);
            windowUnit();
        popMatrix();
        multTranslation([-3,17,0]);
        multScale([1,1,10.10]); 
        windowUnit();
    }

    function windowsMedium() {
        pushMatrix();
            windowRowMedium();
        popMatrix();
        multTranslation([0,3,0]);
        windowRowMedium();
    }

    function windowsRowSmall() {
        pushMatrix();
            multTranslation([1.4,0,0]);
            multScale([1,1,7.25]);
            windowUnit();
        popMatrix();
        multTranslation([-1.4,0,0]);
        multScale([1,1,7.25]);
        windowUnit(); 
    }

    function windowsSmall() {
        pushMatrix();
            multTranslation([0,7.5,0]);
            windowsRowSmall();
        popMatrix();
        multTranslation([0,4.7,0]);
        windowsRowSmall();
    }

    function centralBuilding() {
        pushMatrix();
            pushMatrix();
                multTranslation([0,2.25,0]);
                multScale([15,25,15]);
                buildingParts();
            popMatrix();
            pushMatrix();
                windowsBig();
            popMatrix();
            multRotationY(90);
            windowsBig();
        popMatrix();    
        pushMatrix();
            pushMatrix();
                multTranslation([0,18,0]);
                multScale([10,10,10]);
                buildingParts();
            popMatrix();
            pushMatrix();
                windowsMedium();   
            popMatrix();
                multRotationY(90);
                windowsMedium();   
        popMatrix();
        pushMatrix();
            pushMatrix();
                multTranslation([0,26,0]);
                multScale([7,9,7]);
                buildingParts();
            popMatrix();
            pushMatrix(); 
                multTranslation([0,20.25,0]);
                windowsSmall();
            popMatrix();
            multTranslation([0,20.25,0]);
            multRotationY(90);
            windowsSmall();
        popMatrix();
        multTranslation([0,33,0]);
        multScale([2,10,2]);
        buildingParts();
    }

    function straightLines4Letters() {
        let white = vec3(1,1,1);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        gl.uniform3fv(uColor1, white);
        gl.uniform3fv(uColor2, white);
        gl.uniform3fv(uColor3, white);

        multScale([4,0.5,0.5]);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function circle4Letters(color) {
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor6 = gl.getUniformLocation(program, "uColor6");
        gl.uniform3fv(uColor1, color);
        gl.uniform3fv(uColor6, color);

        multRotationX(90);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }    

    function letterL() {
        pushMatrix();
            multTranslation([17,-2,0]);
            multScale([0.65,1,1]);
            straightLines4Letters();
        popMatrix();   
        multTranslation([16,0.3,0]);
        multRotationZ(90);
        straightLines4Letters();
    }

    function letterE() {
        pushMatrix();
            multTranslation([13.35,2,0]);
            multScale([0.65,1,1]);
            straightLines4Letters();
        popMatrix();        
        pushMatrix();
            multTranslation([12.3,0,0]);
            multRotationZ(90);
            multScale([0.85,1,1]);
            straightLines4Letters();
        popMatrix();        
        pushMatrix();
            multTranslation([13.35,-2,0]);
            multScale([0.65,1,1]);
            straightLines4Letters();
        popMatrix(); 
        multTranslation([13.35,0,0]);
        multScale([0.65,1,1]);
        straightLines4Letters();          
    }

    function letterT() {
        pushMatrix();
            multTranslation([9.3,2,0]);
            straightLines4Letters();
        popMatrix();    
        multTranslation([9.3,-0.3,0]);
        multRotationZ(90);
        straightLines4Letters();     
    }

    function letterO() {
        pushMatrix();
            multTranslation([5,0,0]);
            multScale([4.5,5,0.2]);
            circle4Letters(vec3(1,1,1));
        popMatrix(); 
        multTranslation([5,0,0.25]);
        multScale([3.4,3.9,0.1]);
        circle4Letters(vec3(0.66,0.66,0.66));   
    }

    function letterH() {
        pushMatrix();
            multScale([0.6,1,1]);
            straightLines4Letters();
        popMatrix();
        pushMatrix();
            multTranslation([-1.5,0,0]);
            multRotationZ(90);
            straightLines4Letters();
        popMatrix();
        multTranslation([1.5,0,0]);
        multRotationZ(90);
        straightLines4Letters();  
    }

    function hotelLetters() {
        pushMatrix();
            letterH();
        popMatrix();
        pushMatrix();
            letterO();
        popMatrix();
        pushMatrix();
            letterT();
        popMatrix();
        pushMatrix();
            letterE();
        popMatrix();
        letterL();
    }

    function hotel() {
        pushMatrix();
            multTranslation([7,7.5,-53]);
            multScale([34,35,14]);
            buildingParts();
        popMatrix();    
        pushMatrix();
            multTranslation([-2,20,-45.8]);
            hotelLetters();
        popMatrix();
        pushMatrix();
            multTranslation([-1,1.8,-53]);
            multScale([1,1,0.92]);
            windowsBig();
        popMatrix();
        pushMatrix();
            multTranslation([15,1.8,-53]);
            multScale([1,1,0.92]);
            windowsBig();
        popMatrix();        
        pushMatrix();
            multTranslation([16,1,-55]);     
            windowsMedium();
        popMatrix();
        pushMatrix();
            multTranslation([7,1,-55]);     
            windowsMedium();
        popMatrix();   
        multTranslation([-2,1,-55]);     
        windowsMedium(); 
    }

    function buildings() {
        pushMatrix();
            multTranslation([0,10.2,0]);
            pushMatrix();
                centralBuilding();
            popMatrix();
            pushMatrix();
                hotel();
            popMatrix();
            pushMatrix();
                multTranslation([-50,0,-30]);
                multScale([12,20,8]);
                buildingParts();
            popMatrix();
            pushMatrix();
                multTranslation([-35,0,-30]);
                multScale([8,20,8]);
                buildingParts();
            popMatrix();
            pushMatrix();
                multTranslation([-35,0,-50]);
                multScale([16,20,8]);
                buildingParts();
            popMatrix();
            pushMatrix();
                multTranslation([42,5,-50]);
                multScale([12,30,8]);
                buildingParts();
            popMatrix();    
            pushMatrix();
                multTranslation([-50,5,-50]);
                multScale([12,30,8]);
                buildingParts();
            popMatrix();     
            pushMatrix();
                multTranslation([45,0,50]);
                multScale([18,20,10]);
                buildingParts();
            popMatrix();   
            multTranslation([45,-2.5,38]);
            multScale([18,15,10]);
            buildingParts();                                        
        popMatrix();
    }

    function partOfSidewalk() {             
        let lightGrey = vec3(0.827,0.827,0.827);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        gl.uniform3fv(uColor1, lightGrey);

        uploadModelView();

        CUBE.draw(gl, program, mode);        
    }

    function floorRoadDash(i) {
        multTranslation([i,0.025,0]);
        if (i == -59 || i == 59)
            multScale([0.5,1,1]);

        let white = vec3(1,1,1);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        gl.uniform3fv(uColor1, white);
        gl.uniform3fv(uColor2, white);
        gl.uniform3fv(uColor3, white);

        multScale([4,0.25,0.5]);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function floorRoadUnit() {
        pushMatrix();
            road();
        popMatrix();
        let i = -59;
        while (i < 60) {
            pushMatrix();
                floorRoadDash(i);   
            popMatrix();
            i += 6;
        } 
        pushMatrix();
            multTranslation([0,-0.15,-5]);
            multScale([120,0.25,2]);
            partOfSidewalk();
        popMatrix();   
        multTranslation([0,-0.15,5]);
        multScale([120,0.25,2]);
        partOfSidewalk();
    }

    function road() {
        let grey = vec3(0.2,0.2,0.2);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        gl.uniform3fv(uColor1, grey);
        gl.uniform3fv(uColor2, grey);
        gl.uniform3fv(uColor3, grey);

        multScale([120,0.25,8]);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function floorRoads() {
        pushMatrix();
            multTranslation([0,0.25,-40]);
            floorRoadUnit();
        popMatrix();
        pushMatrix();
            multRotationY(90);
            multTranslation([0,0.25,30]);
            floorRoadUnit();            
        popMatrix();
        pushMatrix();
            multRotationY(90);
            multTranslation([0,0.25,-16]);
            floorRoadUnit();            
        popMatrix();    
        multTranslation([-41,0.025,11]);
        multScale([38,0.25,2]);
        partOfSidewalk();
    }

    function floorBase() {
        let grey = vec3(0.25,0.25,0.25);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        gl.uniform3fv(uColor1, grey);
        gl.uniform3fv(uColor2, grey);
        gl.uniform3fv(uColor3, grey);

        multScale([120,0.25,120]);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function straightLines4ParkingLot() {
        let white = vec3(1,1,1);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        gl.uniform3fv(uColor1, white);

        multScale([22,0.3,0.1]);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function verticalLines(x) {
        pushMatrix();
            multTranslation([x,0.2,0]);
            multRotationY(90);
            multScale([0.2,0.3,0.1]);
            straightLines4ParkingLot();
        popMatrix();        
    }

    function lineOfParkingLot() {
        pushMatrix();
            multTranslation([-40,0,0]);
            straightLines4ParkingLot();
        popMatrix();
        verticalLines(-51);
        verticalLines(-49);
        verticalLines(-47);
        verticalLines(-45);
        verticalLines(-43);
        verticalLines(-41);
        verticalLines(-39); 
        verticalLines(-37);
        verticalLines(-35);
        verticalLines(-33);
        verticalLines(-31);
        verticalLines(-29);
    }

    function parkingLot() {
        pushMatrix();
            lineOfParkingLot();
        popMatrix();
        pushMatrix();
            multTranslation([0,0,-8]);
            lineOfParkingLot();
        popMatrix();
        multTranslation([0,0,-16]);
        lineOfParkingLot();   
    }

    function floor() {
        pushMatrix();
            floorBase();
        popMatrix();
        pushMatrix();
            floorRoads();
        popMatrix(); 
        pushMatrix();
            parkingLot();
        popMatrix();
    }

    function pyramidForTree() {
        let green = vec3(0.075,0.31,0.075);
        gl.useProgram(program);
        const uColor6 = gl.getUniformLocation(program, "uColor6");
        gl.uniform3fv(uColor6, green);

        multScale([2,2,2]);
        multTranslation([0,1,0]);

        uploadModelView();

        PYRAMID.draw(gl, program, mode);        
    }

    function partOfTree(){
        pushMatrix();
            multTranslation([0,1.8,0]);
            pyramidForTree();
        popMatrix();
        pyramidForTree();     
    }

    function tree() {              
        pushMatrix();
            partOfTree();
        popMatrix();
        pushMatrix();
            multRotationY(30);
            partOfTree();
        popMatrix();
        multRotationY(120);
        partOfTree();     
    }

    function treesPos() {
        trees.push([-50.7,30]);
        trees.push([-40,20]);
        trees.push([-45,20]);
        trees.push([-55,20]);
        trees.push([-45,30]);
        trees.push([-47,33]);
        trees.push([-47.5,30.8]);
        trees.push([-45.5,26]);
        trees.push([-50,26]);
        trees.push([-50,22]);
        trees.push([-54,24]);
        trees.push([-54,40]);
        trees.push([-50,43]);
    }

    treesPos();

    function setOfTrees() {
        for (let i = 0; i < trees.length; i++) {
            pushMatrix();
                multTranslation([trees[i][0],-0.7,trees[i][1]]);
                tree();
            popMatrix(); 
        }        
    }

    function partOfLake() {
        let blue = vec3(0.13,0.7,0.67);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor6 = gl.getUniformLocation(program, "uColor6");
        gl.uniform3fv(uColor1, blue);
        gl.uniform3fv(uColor6, blue);

        multTranslation([0,0.15,0]);
        multScale([8,0.25,8]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);  
    }

    function lakes() {
        pushMatrix();
            multTranslation([15,0,4]);
            partOfLake();     
        popMatrix(); 
        pushMatrix();
            multTranslation([17,0,0]);
            partOfLake();    
        popMatrix();
        pushMatrix();
            multTranslation([20,0,6]);
            partOfLake();            
        popMatrix();
        pushMatrix();
            multTranslation([20,0,12]);
            partOfLake();            
        popMatrix();
        pushMatrix();
            multTranslation([10,0,22]);
            partOfLake();            
        popMatrix();  
        multTranslation([14,0,23]);
        partOfLake();           
    }

    function grass() {
        let green = vec3(0,0.6,0.09);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor6 = gl.getUniformLocation(program, "uColor6");
        gl.uniform3fv(uColor1, green);
        gl.uniform3fv(uColor6, green);

        multTranslation([-41,0.05,36]);
        multScale([38,0.25,48]);

        uploadModelView();

        CUBE.draw(gl, program, mode); 
    }

    //creates the garden
    function garden() {
        pushMatrix();
            setOfTrees();
        popMatrix();  
        pushMatrix();
            multTranslation([-50,0,30]);
            lakes();
        popMatrix();
        grass();
    }

    //creates the cenary with all its building, road and the garden
    function cenary() {
        buildings();
        floor();
        garden();
    }

    //creates the tail
    function tailBody() {
        multTranslation([4, 0.65, 0]);
        multScale([5.20, 0.75, 0.75]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    //creates the cockpit
    function cockpit() {
        paintheli(vec3(0,0,0.5));
        multScale([5.56, 2.6, 2.6]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    //creates the fin of the helicopter
    function tailFin() {
        paintheli(vec3(0,0,0.5));
        multRotationZ(-20);
        multScale([0.75, 1.5, 0.75]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    //creates the rotor of the tail of the helicopter
    function tailRotor() {
        multScale([.25, 1, .25]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    //creates the blades of the tail of the helicopter
    function tailBlades(xTrans) {
        paintheli(vec3(1,1,1));
        multTranslation([xTrans * 0.6, 0.8, 0]);
        multScale([1, 0.2, 0.2]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    //function that paints the instance that its called in
    function paintheli(color){
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        const uColor4 = gl.getUniformLocation(program, "uColor4");
        const uColor5 = gl.getUniformLocation(program, "uColor5");
        const uColor6 = gl.getUniformLocation(program, "uColor6");
        gl.uniform3fv(uColor1, color);
        gl.uniform3fv(uColor2, color);
        gl.uniform3fv(uColor3, color);
        gl.uniform3fv(uColor4, color);
        gl.uniform3fv(uColor5, color);
        gl.uniform3fv(uColor6, color);
    }

    //creates the body of the helicopter
    function body(blade_angle) {
        pushMatrix();
            cockpit();
        popMatrix();
        pushMatrix();
            tailBody();
        popMatrix();
        pushMatrix();
            multTranslation([6.55, 1.2, 0]);
            pushMatrix();
                tailFin();
            popMatrix();
            multRotationX(90);
            multRotationY(2*blade_angle);
            pushMatrix();
                multTranslation([0, 0.4, 0]);
                tailRotor();
            popMatrix();
            pushMatrix();
                tailBlades(1);
            popMatrix();
            tailBlades(-1);
        popMatrix();
    }

    //creates the top rotor of the helicopter
    function topRotor() {
        paintheli(vec3(0.8,0.9,0,87));
        multScale([0.2, 1.3, 0.2]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    //creates a balde
    function blade() {
        paintheli(vec3(1,1,1));
        multTranslation([2.5, 0.35, 0]);
        multScale([5, 0.2, 0.5]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    //creates the top blades with 120 degrees between them
    function topBlades(blade_angle) {
        multTranslation([0.4, 1.25, 0]);
        multRotationY(blade_angle);

        uploadModelView();

        pushMatrix();
            topRotor();
        popMatrix();
        pushMatrix();
            pushMatrix();
                multRotationY(-120);
                blade();
            popMatrix();
            pushMatrix();
                multRotationY(120);
                blade();
            popMatrix();
            blade();
        popMatrix();
    }

    //creates a connector
    function connector(i) {
        paintheli(vec3(0.5,0.5,0,5));
        multTranslation([0, -0.2, 0]);
        multRotationX(-30);
        multRotationZ(i*30);
        multTranslation([i*2.5 / 2, 0, 0]);
        multScale([1 / 5, 0.85, 1 / 5]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    //creates a skid
    function skid() {
        paintheli(vec3(0.98,0.98,0.98));
        multScale([5, 0.2, 0.2]);
        multRotationZ(90);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    //creates a group of one skid and two connectors
    function skidPlusConnectors() {
        pushMatrix();
            pushMatrix();
                multTranslation([0, -1.5, 1.1]);
                pushMatrix();
                    connector(-1);
                popMatrix();
                pushMatrix();
                    connector(1);
                popMatrix();
                skid();
            popMatrix();
            multRotationY(180);
            multTranslation([0, -1.5, 1.1]);
            pushMatrix();
                connector(-1);
            popMatrix();
            pushMatrix();
                connector(1);
            popMatrix();
            skid();
        popMatrix();
    }

    //creates a box and calculates where it is and the age, as well as its colors
    function dropBox(box) {

        let brown1 = vec3(0.57,0.40,0.18);
        let brown2 = vec3(0.73,0.56,0.32);
        let brown3 = vec3(0.70,0.53,0.29);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        gl.uniform3fv(uColor1, brown3);
        gl.uniform3fv(uColor2, brown1);
        gl.uniform3fv(uColor3, brown2);

        if(box[0] >= 0.75) {
            if(box[0] - box[4] <= 0.75) { 
                box[0] = 0.75;
            } else { 
                box[0] -=  box[4];
                box[4] = box[4]+0.05;
            }
            multTranslation([0,box[0],0]);

        }
        if(box[1] <= time) boxes.splice(boxes.indexOf(box),1);
        
        multScale([1.5,1.5,1.5])
        uploadModelView();

        CUBE.draw(gl, program, mode);
    }


    //in every call in render(), updates the blade's speed and angle
    function setBladesSpeed() {
        let dif_vel = lastVelocity - velocity;
        if (velocity == 0) {
            if (distancey <= 0 && heli_tilt == 0) {
                if (bladesSpeed < 0.0001) bladesSpeed = 0;
                bladesSpeed = bladesSpeed/1.1;
            } else {
                if (bladesSpeed < BLADE_SPEED) {
                    if (bladesSpeed < 1) bladesSpeed = 1;
                    bladesSpeed *= 1.05; 
                }
                if (bladesSpeed > BLADE_SPEED) bladesSpeed = BLADE_SPEED;
            }
        } else { 
            if (bladesSpeed < MAX_BLADE_SPEED) {
                    bladesSpeed += BLADE_SPEED*(-dif_vel);
            } else {
                    bladesSpeed = MAX_BLADE_SPEED;
            }
        }
    }

    //updates the velocity of helicopter and the tilting angle
    function updateParameters() {
        if (breaking) {
            velocity /= DECELARATION;
            if (velocity <= 0.001) {
                velocity = 0;
                breaking = false;
            }
        }
        setBladesSpeed();
        
        heli_tilt = velocity * MAX_TILT/MAX_VELOCITY;  // MAX_VELOCITY = 2 => MAX_ANGLE = 30;
        angle += velocity;
        blade_angle += bladesSpeed; 

        lastVelocity = velocity;
    }

    //build all instances in the app
    function renderInstances() {
        pushMatrix();
            cenary();
        popMatrix();  
        pushMatrix();
            multRotationY(-angle);
            multTranslation([MOV_RAD, 0, 0]);
            multRotationY(90);
            //rotation applied on the down front Z-axis of the helicopter to guarantee that it dont rotate into the ground
            multTranslation([-5.56/2,distancey+0.25,0]);
            multRotationZ(heli_tilt);
            multTranslation([5.56/2,1.5,0]);
            body((blade_angle));
            skidPlusConnectors();
            topBlades((blade_angle));
        popMatrix();
        boxes.forEach(box => {
            pushMatrix();            
                if (box[0] > 0.75 ) box[2] += box[3]; 
                multRotationY(-box[2]);
                pushMatrix();     
                    multTranslation([MOV_RAD, 0, 0]);
                    dropBox(box);
                popMatrix();
            popMatrix();
        });
    }

    //calculates the view matrix
    function getView(){
        const r = VP_DISTANCE;

        const a = r * -Math.cos(camController.gamma*DEGRE2RAD);

        const x = a * Math.cos(camController.theta*DEGRE2RAD);
        const y = r * Math.sin(camController.gamma*DEGRE2RAD);
        const z = a * -Math.sin(camController.theta*DEGRE2RAD);

        return lookAt([x,y,z], [0,0,0], [0,1,0]);
    }

    function render() {
        if (animation) time += speed;

        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
            
        updateParameters();
        
        renderInstances(); 

        loadMatrix(getView());
    }

}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
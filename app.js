import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";

import { ortho, lookAt, flatten, mult, normalize, length, vec3, mat4, vec4, inverse, printm} from "../../libs/MV.js";

import { modelView, loadMatrix, multRotationY, multRotationZ, multScale, multRotationX, multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";


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

const VP_DISTANCE = 60;

const ACELARATION = 1.2;
const DECELARATION = 1.1;
const MAX_VELOCITY = 1;
const BLADE_SPEED = 10;
const MAX_HEIGHT = 20;
const HEIGHT_RATIO = 0.5;
const MAX_BLADE_SPEED = 300;
const MAX_TILT = 30;
const STARTING_HEIGHT = 10;
const MOVEMENT_RADIUS = 30;
const STARTING_POSITION = 90;
const BOX_LIFETIME = 15;



const v = mat4(
    vec4(1,0,0,0),
    vec4(0,1,0,0), 
    vec4(0,0,1,0), 
    vec4(0,0,0,1)
    );

let xAngle = 45* 2*Math.PI/360;
let yAngle = 45* 2*Math.PI/360;

let mView = v;


let bladesSpeed = BLADE_SPEED;


let angle = STARTING_POSITION;
let distancey = STARTING_HEIGHT;
let distancex = MOVEMENT_RADIUS;
let velocity = 0;
let breaking = false;
let heli_tilt = 0;
let blade_angle = 0;
let lastVelocity = velocity;
let fallSpeed = 10/VP_DISTANCE;

let boxes = [];

function setup(shaders) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);
    
    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE * aspect, VP_DISTANCE * aspect, -VP_DISTANCE, VP_DISTANCE, -3 * VP_DISTANCE, 3 * VP_DISTANCE);

    mode = gl.TRIANGLES;

    resize_canvas();

    window.addEventListener("resize", resize_canvas);

    document.getElementById("axonometric").addEventListener("change", setAxonometricView);

    document.getElementById("front").addEventListener("change", setFrontView);

    document.getElementById("side").addEventListener("change", setSideView);

    document.getElementById("top").addEventListener("change", setTopView);


    document.getElementById("rotCamY").addEventListener("input", function(event){
        yAngle = (document.getElementById("rotCamY").value)*Math.PI*2/(360);

    });

    document.getElementById("rotCamX").addEventListener("input", function(event){
        xAngle = (document.getElementById("rotCamX").value)*Math.PI*2/(360);
    });

    function setAxonometricView(){
        xAngle = 45 * Math.PI*2 /360;
        yAngle = 45 * Math.PI*2 /360;
    }

    function setSideView(){
        xAngle = 0;
        yAngle = 0;
    }

    function setFrontView(){
        xAngle = 0;
        yAngle = 90 *Math.PI*2 /360;        
    }

    function setTopView(){
        xAngle = 90 *Math.PI*2 /360;
        yAngle = 90 *Math.PI*2 /360;
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
                console.log("boxe draw!")
                boxes.push([distancey-2, time+5, angle, velocity]);
                break;
            case 'ArrowUp':
                if(distancey < MAX_HEIGHT)
                    distancey += HEIGHT_RATIO;
                break;
            case 'ArrowDown':
                if (distancey >= HEIGHT_RATIO)
                    distancey -= HEIGHT_RATIO;
                break;
            case 'ArrowLeft':
                if(velocity <= MAX_VELOCITY && distancey > 0){
                    breaking = false;
                    if(velocity <= 0) velocity = 0.10;
                    if(velocity*ACELARATION > MAX_VELOCITY) 
                        velocity = MAX_VELOCITY;
                    else
                        velocity *= ACELARATION;
                }
                break;
                
        }
    }

    document.onkeyup = function(event) {
        if(event.key === "ArrowLeft")
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
        let yellow1 = vec3(0.4,0.4,0.4);    // cima
        let yellow2 = vec3(0.5,0.5,0.5);   // esquerda
        let yellow3 = vec3(0.66,0.66,0.66);      // direita
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
            multScale([1,1,15.25]);
            multTranslation([4.5,0,0]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multScale([1,1,15.25]);
            multTranslation([2,0,0]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multScale([1,1,15.25]);
            multTranslation([-2,0,0]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multScale([1,1,15.25]);
            multTranslation([-4.5,0,0]);
            windowUnit();
        popMatrix();
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
        pushMatrix();
            multTranslation([0,-6,0]);
            windowRowBig();
        popMatrix();
    }

    function windowRowMedium() {
        pushMatrix();
            multScale([1,1,10.10]);
            multTranslation([3,17,0]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multScale([1,1,10.10]);
            multTranslation([-0.05,17,0]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multScale([1,1,10.10]); 
            multTranslation([-3,17,0]);
            windowUnit();
        popMatrix();
    }

    function windowsMedium() {
        pushMatrix();
            windowRowMedium();
        popMatrix();
        pushMatrix();
            multTranslation([0,3,0]);
            windowRowMedium();
        popMatrix();
    }

    function windowsRowSmall() {
        pushMatrix();
            multScale([1,1,7.25]);
            multTranslation([1.4,0,0]);
            windowUnit();
        popMatrix();
        pushMatrix();
            multScale([1,1,7.25]);
            multTranslation([-1.4,0,0]);
            windowUnit();
        popMatrix();        
    }

    function windowsSmall() {
        pushMatrix();
            multTranslation([0,7.5,0]);
            windowsRowSmall();
        popMatrix();
        pushMatrix();
            multTranslation([0,4.7,0]);
            windowsRowSmall();
        popMatrix();   
    }

    function centralBuilding() {
        pushMatrix();
            pushMatrix();
                multTranslation([0,2.25,0]);
                multScale([15,25,15]);
                buildingParts();
            popMatrix();
            pushMatrix();
                pushMatrix();
                    windowsBig();
                popMatrix();
                pushMatrix();
                    multRotationY(90);
                    windowsBig();
                popMatrix();
            popMatrix();
        popMatrix();    
        pushMatrix();
            pushMatrix();
                multTranslation([0,18,0]);
                multScale([10,10,10]);
                buildingParts();
            popMatrix();
            pushMatrix();
                pushMatrix();
                    windowsMedium();   
                popMatrix();
                pushMatrix();
                    multRotationY(90);
                    windowsMedium();    
                popMatrix();     
            popMatrix();
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
            pushMatrix();
                multTranslation([0,20.25,0]);
                multRotationY(90);
                windowsSmall();
            popMatrix();
        popMatrix();
        pushMatrix();
            multTranslation([0,33,0]);
            multScale([2,10,2]);
            buildingParts();
        popMatrix();
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
        pushMatrix();
            multTranslation([16,0.3,0]);
            multRotationZ(90);
            straightLines4Letters();
        popMatrix();         
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
        pushMatrix();
            multTranslation([13.35,0,0]);
            multScale([0.65,1,1]);
            straightLines4Letters();
        popMatrix();                
    }

    function letterT() {
        pushMatrix();
            multTranslation([9.3,2,0]);
            straightLines4Letters();
        popMatrix();        
        pushMatrix();
            multTranslation([9.3,-0.3,0]);
            multRotationZ(90);
            straightLines4Letters();
        popMatrix();         
    }

    function letterO() {
        pushMatrix();
            multTranslation([5,0,0]);
            multScale([4.5,5,0.2]);
            circle4Letters(vec3(1,1,1));
        popMatrix();   
        pushMatrix();
            multTranslation([5,0,0.25]);
            multScale([3.4,3.9,0.1]);
            circle4Letters(vec3(0.66,0.66,0.66));
        popMatrix();         
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
        pushMatrix();
            multTranslation([1.5,0,0]);
            multRotationZ(90);
            straightLines4Letters();
        popMatrix();      
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
        pushMatrix();
            letterL();
        popMatrix();
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
        pushMatrix();
            multTranslation([-2,1,-55]);     
            windowsMedium();
        popMatrix();        
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
                pushMatrix();
                    multTranslation([45,-2.5,38]);
                    multScale([18,15,10]);
                    buildingParts();
                popMatrix();                                          
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
        // VER PQQ NAO APARECE !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        pushMatrix();
            multTranslation([-40,0.025,0]);
            multScale([0.5,1,1]);
            floorRoadDash();
        popMatrix();   

        pushMatrix();
            multTranslation([0,-0.15,-5]);
            multScale([120,0.25,2]);
            partOfSidewalk();
        popMatrix();    
        pushMatrix();
            multTranslation([0,-0.15,5]);
            multScale([120,0.25,2]);
            partOfSidewalk();
        popMatrix();  
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
        pushMatrix();
            multTranslation([-41,0.025,11]);
            multScale([38,0.25,2]);
            partOfSidewalk();
        popMatrix();
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
    }

    function parkingLot() {
        pushMatrix();
            lineOfParkingLot();
        popMatrix();
        pushMatrix();
            multTranslation([0,0,-8]);
            lineOfParkingLot();
        popMatrix();
        pushMatrix();
            multTranslation([0,0,-16]);
            lineOfParkingLot();
        popMatrix();        
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
        pushMatrix();
            pyramidForTree();
        popMatrix();        
    }

    function tree() {              
        pushMatrix();
            partOfTree();
        popMatrix();
        pushMatrix();
            multRotationY(30);
            partOfTree();
        popMatrix();
        pushMatrix();
            multRotationY(120);
            partOfTree();
        popMatrix();        
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
        pushMatrix();
            multTranslation([14,0,23]);
            partOfLake();            
        popMatrix();            
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

    function garden() {
        pushMatrix();
            setOfTrees();
        popMatrix();  
        pushMatrix();
            multTranslation([-50,0,30]);
            lakes();
        popMatrix();
        pushMatrix();
            grass();
        popMatrix();
    }

    function cenary() {
        buildings();
        floor();
        garden();
    }

    function tailBody() {
        //greenTroops();
        multTranslation([4, 0.65, 0]);
        multScale([5.20, 0.75, 0.75]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function cockpit() {
        //greenTroops();
        multScale([5.56, 2.6, 2.6]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function tailSkid() {
        //greenTroops();
        multRotationZ(-20);
        multScale([0.75, 1.5, 0.75]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function tailRotor() {
       // greenTroops();
        multScale([.25, 1, .25]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function tailBlades(xTrans) {
       // greenTroops();
        multTranslation([xTrans * 0.6, 0.8, 0]);
        multScale([1, 0.2, 0.2]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function body(velHeli) {
        pushMatrix();
            cockpit();
        popMatrix();
        pushMatrix();
            tailBody();
        popMatrix();

        pushMatrix();
                multTranslation([6.55, 1.2, 0]);
                pushMatrix();
                    tailSkid();
                popMatrix();
                    multRotationX(90);
                    multRotationY(2*velHeli);
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

    function topRotor() {
       // greenTroops();
        multScale([0.2, 1.3, 0.2]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function blade() {
        //greenTroops();
        multTranslation([2.5, 0.35, 0]);
        multScale([5, 0.2, 0.5]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function topBlades(velHeli) {
        multTranslation([0.4, 1.25, 0]);
        multRotationY(velHeli);

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

    function connector(i) {
        //greenTroops();
        multTranslation([0, -0.2, 0]);
        multRotationX(-30);
        multRotationZ(i*30);
        multTranslation([i*2.5 / 2, 0, 0]);
        multScale([1 / 5, 0.85, 1 / 5]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function skid() {
        //greenTroops();
        multScale([5, 0.2, 0.2]);
        multRotationZ(90);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

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

        multScale([1.5,1.5,1.5])
        if(box[0] > 0) {
            if(box[0] - 1 < 0) box[0] = 0;
            else box[0] -=  0.5;
            multTranslation([0,box[0]+ 1.5/2 + 0.25,0]);
        } else {
            if(box[1] <= time)
                boxes.splice(boxes.indexOf(box),1);
        }
        
        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function loadRotationX(){
        return mat4(
            vec4(1,0,0,0), 
            vec4(0, Math.cos(xAngle), -Math.sin(xAngle),0),
            vec4(Math.sin(xAngle),0,Math.cos(xAngle),0), 
            vec4(0,0,0,1)
            );
    }

    function loadRotationY(){
        return mat4(
            vec4(Math.cos(yAngle),0,Math.sin(yAngle),0),
            vec4(0,1,0,0), 
            vec4(-Math.sin(yAngle),0,Math.cos(yAngle),0), 
            vec4(0,0,0,1)
            );
    }

    function printInfo(){
        console.log("Velocity: " + velocity);
        console.log("Is it Breaking: " + breaking);
        console.log("Angle: " + (angle%360) );
        console.log("Tilt: " + (heli_tilt) );
        console.log("Height: " + distancey);
        console.log("Blades Speed: " + bladesSpeed );
    }

    //in every call in render(), updates the blade's speed and angle
    function setBladesSpeed(){
        let dif_vel = lastVelocity - velocity;
        if(velocity == 0){
            if(distancey <= 0 && heli_tilt == 0){
                if(bladesSpeed < 0.0001) bladesSpeed = 0;
                bladesSpeed = bladesSpeed/1.1;
            } else {
                if(bladesSpeed < BLADE_SPEED){
                    if(bladesSpeed < 1) bladesSpeed = 1;
                    bladesSpeed *= 1.05; 
                }
                if(bladesSpeed > BLADE_SPEED) bladesSpeed = BLADE_SPEED;
            }
        } else { 
            if(bladesSpeed < MAX_BLADE_SPEED){
                    bladesSpeed += BLADE_SPEED*(-dif_vel);
            } else {
                    bladesSpeed = MAX_BLADE_SPEED;
            }
        }
    }

    //updates the velocity of helicopter and the tilting angle
    function updateParameters() {
        if(breaking) {
            velocity /= 1.1;
            if (velocity <= 0.001){
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


    function renderInstances(){
        pushMatrix();
            multRotationY(-angle);
            multTranslation([distancex, 0, 0]);
           
            multRotationY(90);
                pushMatrix();
                    //rotation applied on the down front Z-axis of the helicopter to guarantee that it dont rotate into the ground
                    multTranslation([-5.56/2,distancey+0.25,0]);

                    multRotationZ(heli_tilt);
                    multTranslation([5.56/2,1.5,0]);
                    body((blade_angle));
                    skidPlusConnectors();
                    topBlades((blade_angle));
            popMatrix();
        popMatrix();
        pushMatrix();
        boxes.forEach(box => {
            pushMatrix();
            console.log("box " + box);
            
            if(box[0] > 0 ) box[2] += velocity; 
            multRotationY(-box[2]);
            pushMatrix();     
            multTranslation([distancex, 0, 0]);
                dropBox(box);
            popMatrix();
            popMatrix();
        });
        pushMatrix();
            cenary();
        popMatrix();
        popMatrix();
       
    }

    function render() {
        if (animation) time += speed;

        console.log(time);
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        mView = mult(mult(v, loadRotationX()), loadRotationY());
        
        loadMatrix(mView);
        
        //printInfo();

        updateParameters();

        renderInstances();
    }

}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
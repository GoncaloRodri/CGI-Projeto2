import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";

import { ortho, lookAt, flatten, mult, normalize, length, vec3, mat4, vec4, inverse, printm} from "../../libs/MV.js";

import { modelView, loadMatrix, multRotationY, multRotationZ, multScale, multRotationX, multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";


import * as SPHERE from '../../libs/objects/sphere.js';

import * as CYLINDER from '../../libs/objects/cylinder.js';

import * as CUBE from '../../libs/objects/cube.js';

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1 / 60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running


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
    vec4(0,0,0,0), 
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

    function buildingParts() {
        red();
        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function yellow() {
        let yellow = vec3(0.94,0.9,0.55);
        let yelloww = vec3(0.94,0.95,0.55);
        let yellowww = vec3(0.90,0.97,0.55);
        let yellowwww = vec3(0.98,0.92,0.59);
        gl.useProgram(program);
        const uColor1 = gl.getUniformLocation(program, "uColor1");
        const uColor2 = gl.getUniformLocation(program, "uColor2");
        const uColor3 = gl.getUniformLocation(program, "uColor3");
        const uColor4 = gl.getUniformLocation(program, "uColor4");
        gl.uniform3fv(uColor1, yellow);
        gl.uniform3fv(uColor2, yelloww);
        gl.uniform3fv(uColor3, yellowww);
        gl.uniform3fv(uColor4, yellowwww);
    }

    function red() {
        let yellow = vec3(0.94,0,0);
        gl.useProgram(program);
        const uColor = gl.getUniformLocation(program, "uColor");
        gl.uniform3fv(uColor, yellow);
    }

    function greenTroops() {
        let yellow = vec3(0.34,0.42,0.18);
        gl.useProgram(program);
        const uColor = gl.getUniformLocation(program, "uColor");
        gl.uniform3fv(uColor, yellow);
    }

    function buildings() {
        //start of central building
        pushMatrix();
            multScale([10,20,10]);
            buildingParts();
        popMatrix();    
        pushMatrix();
            multTranslation([0,14,0]);
            multScale([7,8,7]);
            buildingParts();
        popMatrix();
        pushMatrix();
            multTranslation([0,20,0]);
            multScale([4,6,4]);
            buildingParts();
        popMatrix();
        pushMatrix();
            multTranslation([0,20,0]);
            multScale([4,6,4]);
            buildingParts();
        popMatrix();
        pushMatrix();
            multTranslation([0,25,0]);
            multScale([1.5,10,1.5]);
            buildingParts();
        popMatrix();
        //end of central building
        pushMatrix();
            multTranslation([50,-3,0]);
            multScale([5,14,5]);
            buildingParts();
        popMatrix();
        pushMatrix();
            multTranslation([-75,40,0]);
            multScale([12,20,8]);
            buildingParts();
        popMatrix();
        pushMatrix();
            multTranslation([-65,45,-8]);
            multScale([16,20,8]);
            buildingParts();
        popMatrix();
    }

    function floor() {
        yellow();
        multScale([120,0.25,120]);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function cenary() {
        buildings();
        floor()
    }

    function tailBody() {
        greenTroops();
        multTranslation([4, 0.65, 0]);
        multScale([5.20, 0.75, 0.75]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function cockpit() {
        greenTroops();
        multScale([5.56, 2.6, 2.6]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function tailSkid() {
        greenTroops();
        multRotationZ(-25);
        multScale([0.75, 1.5, 0.75]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function tailRotor() {
        greenTroops();
        multScale([.25, 1, .25]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function tailBlades(xTrans) {
        greenTroops();
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
        greenTroops();
        multScale([0.2, 1.3, 0.2]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function blade() {
        greenTroops();
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
        greenTroops();
        multTranslation([0, -0.2, 0]);
        multRotationX(-30);
        multRotationZ(i*30);
        multTranslation([i*2.5 / 2, 0, 0]);
        multScale([1 / 5, 0.85, 1 / 5]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function skid() {
        greenTroops();
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
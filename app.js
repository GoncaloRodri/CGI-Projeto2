import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationY, multRotationZ, multScale, multRotationX, multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';

import * as CYLINDER from '../../libs/objects/cylinder.js';

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

const PLANET_SCALE = 10;    // scale that will apply to each planet and satellite
const ORBIT_SCALE = 1/60;   // scale that will apply to each orbit around the sun

const HElI_BODY_XY = 1;
const HElI_BODY_Z = 4;

const VP_DISTANCE = 5;
let c = 0;


const AXONOMETRIC_VIEW = [-VP_DISTANCE,VP_DISTANCE,VP_DISTANCE];
const FRONT_VIEW = [-VP_DISTANCE, 0, 0];
const SIDE_VIEW = [0,0,VP_DISTANCE];
const TOP_VIEW = [0, 0, 0];
const DEFAULT_UP = [0,1,0];
const TOP_UP = [1,0,0];
const DEFAULT_AT = [0,0,0];
const TOP_AT = [0,-1,0];

let view = AXONOMETRIC_VIEW;

let at = DEFAULT_AT;

let up = DEFAULT_UP;

let velHeli = 0;



function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);

    mode = gl.TRIANGLES; 

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.getElementById("axonometric").addEventListener("change", setAxonometricView);

    document.getElementById("front").addEventListener("change", setFrontView);

    document.getElementById("side").addEventListener("change", setSideView);

    document.getElementById("top").addEventListener("change", setTopView);

    function setAxonometricView(){
        view = AXONOMETRIC_VIEW;
        up = DEFAULT_UP;
        at = DEFAULT_AT;
    }

    function setSideView(){
        view = SIDE_VIEW;
        up = DEFAULT_UP;
        at = DEFAULT_AT;
    }

    function setFrontView(){
        view = FRONT_VIEW;
        up = DEFAULT_UP;
        at = DEFAULT_AT;
    }

    function setTopView(){
        view = TOP_VIEW;
        up = TOP_UP;
        at = TOP_AT;
    }

    document.onkeydown = function(event) {
        switch(event.key) {
            case 'w':
                mode = gl.LINES; 
                break;
            case 's':
                mode = gl.TRIANGLES;
                break;
            case 'p':
                animation = !animation;
                break;
            case '+':
                if(animation) speed *= 1.1;
                break;
            case '-':
                if(animation) speed /= 1.1;
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
        }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CYLINDER.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function Tail(){
         // Don't forget to scale the sun, rotate it around the y axis at the correct speed
        //multRotationY(c++);
        multTranslation([4, 0.65, 0]);
        multScale([5.20, 0.75, 0.75]);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);
    
    }
    
    function Helicopter()
    {
        // Don't forget to scale the sun, rotate it around the y axis at the correct speed
        multScale([5.56, 2.6, 2.6]);     

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);
        
    }

    function Barbatana(){
     
    
        multRotationZ(-30);
        multScale([0.75,1.5,0.75]);
        
        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function EspigãoBack(){

        multScale([.25,1,.25]);

        uploadModelView();

        CYLINDER.draw(gl,program,mode);
    }

    function Pa(xTrans){
        
        multTranslation([xTrans*0.6, 0.8, 0]);
        multScale([1.2, 0.2, 0.2]);
        
        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function render()
    {

        
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        loadMatrix(lookAt(view, at, up));

        
        pushMatrix();
            Helicopter();
        popMatrix();
        pushMatrix();
            Tail();
        popMatrix();
        
        pushMatrix();
            pushMatrix();
            multTranslation([6.60,1.1,0]);
            pushMatrix();
                Barbatana();
            popMatrix();
            pushMatrix();
                multRotationX(90);
                multRotationY(velHeli++);
                pushMatrix();
                multTranslation([0,0.6,0]);
                    EspigãoBack();
                popMatrix();
                pushMatrix();
                    
                    pushMatrix();
                        Pa(1);
                    popMatrix();
                    pushMatrix();
                        Pa(-1);
                    popMatrix();
                popMatrix();

            popMatrix();
        popMatrix();
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
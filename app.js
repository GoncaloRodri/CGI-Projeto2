import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, mult, normalize, length, vec3, mat4, vec4} from "../../libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale, multRotationX } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import { multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";

import Stats from "../../libs/dat.gui.module.js";
import { inverse, printm } from "./libs/MV.js";
/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

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


const v = mat4(
    vec4(1,0,0,0),
    vec4(0,1,0,0), 
    vec4(0,0,0,0), 
    vec4(0,0,0,1)
    );

let xAngle = 45* 2*Math.PI/360;
let yAngle = 45* 2*Math.PI/360;

let mView = v;







function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);
    

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);

    mode = gl.LINES; 

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
        multTranslation([3.5, 0.65, 0]);
        multScale([7, 0.5, 0.5]);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);
    
    }
    
    function Helicopter()
    {
        // Don't forget to scale the sun, rotate it around the y axis at the correct speed
        multScale([5, 2, 2]);     

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);
        
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

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        mView = mult(mult(v, loadRotationX()), loadRotationY());
       
        
        loadMatrix( mView);
        
        pushMatrix();
            Helicopter();
        popMatrix();
        pushMatrix();
            Tail();
        popMatrix();
    }

}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
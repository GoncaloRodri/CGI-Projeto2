import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationY, multRotationZ, multScale, multRotationX, multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';

import * as CYLINDER from '../../libs/objects/cylinder.js';

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1 / 60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

const PLANET_SCALE = 10;    // scale that will apply to each planet and satellite
const ORBIT_SCALE = 1 / 60;   // scale that will apply to each orbit around the sun

const HElI_BODY_XY = 1;
const HElI_BODY_Z = 4;

const VP_DISTANCE = 5;
let c = 0;


const AXONOMETRIC_VIEW = [-VP_DISTANCE, VP_DISTANCE, VP_DISTANCE];
const FRONT_VIEW = [-VP_DISTANCE, 0, 0];
const SIDE_VIEW = [0, 0, VP_DISTANCE];
const TOP_VIEW = [0, 0, 0];
const DEFAULT_UP = [0, 1, 0];
const TOP_UP = [1, 0, 0];
const DEFAULT_AT = [0, 0, 0];
const TOP_AT = [0, -1, 0];

let view = AXONOMETRIC_VIEW;

let at = DEFAULT_AT;

let up = DEFAULT_UP;

let velHeli = 120;



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

    function setAxonometricView() {
        view = AXONOMETRIC_VIEW;
        up = DEFAULT_UP;
        at = DEFAULT_AT;
    }

    function setSideView() {
        view = SIDE_VIEW;
        up = DEFAULT_UP;
        at = DEFAULT_AT;
    }

    function setFrontView() {
        view = FRONT_VIEW;
        up = DEFAULT_UP;
        at = DEFAULT_AT;
    }

    function setTopView() {
        view = TOP_VIEW;
        up = TOP_UP;
        at = TOP_AT;
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
            case '+':
                if (animation) speed *= 1.1;
                break;
            case '-':
                if (animation) speed /= 1.1;
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
            case 'Space':

                break;
            case 'ArrowUp':

                break;
            case 'ArrowDown':

                break;
            case 'ArrowLeft':

                break;
        }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CYLINDER.init(gl);
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

    function tailBody() {
        multTranslation([4, 0.65, 0]);
        multScale([5.20, 0.75, 0.75]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function cockpit() {
        multScale([5.56, 2.6, 2.6]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function tailSkid() {
        multRotationZ(-20);
        multScale([0.75, 1.5, 0.75]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function tailRotor() {
        multScale([.25, 1, .25]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function tailBlades(xTrans) {
        multTranslation([xTrans * 0.6, 0.8, 0]);
        multScale([1, 0.2, 0.2]);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function body() {
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
                    multRotationY(velHeli++);
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
        multScale([0.2, 1.3, 0.2]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function blade() {
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

    function leftConnector() {
        multTranslation([0, -0.2, 0]);
        multRotationX(-30);
        multRotationZ(-30);
        multTranslation([-2.5 / 2, 0, 0]);
        multScale([1 / 5, 0.85, 1 / 5]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function rightConnector() {
        multTranslation([0, -0.2, 0]);
        multRotationX(-30);
        multRotationZ(30);
        multTranslation([2.5 / 2, 0, 0]);
        multScale([1 / 5, 0.85, 1 / 5]);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function skid() {
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
                    leftConnector();
                popMatrix();
                pushMatrix();
                    rightConnector();
                popMatrix();
                    skid();
            popMatrix();
                multRotationY(180);
                multTranslation([0, -1.5, 1.1]);
                pushMatrix();
                    leftConnector();
                popMatrix();
                pushMatrix();
                    rightConnector();
                popMatrix();
                    skid();
        popMatrix();
    }

    function render() {
        if (animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        loadMatrix(lookAt(view, at, up));


        body();

        skidPlusConnectors();

        topBlades(velHeli++);
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
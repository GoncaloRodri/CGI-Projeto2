uniform mat4 mModelView;
uniform mat4 mProjection;

attribute vec4 vPosition;
attribute vec3 vNormal;

varying vec3 fColor;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;

void main() {
    gl_Position = mProjection * mModelView * vPosition;

    if (vNormal.x == 0.0 && vNormal.y > 0.0 && vNormal.z == 0.0 ||
    vNormal.x == 0.0 && vNormal.y < 0.0 && vNormal.z == 0.0)  // partes de cima
        fColor = uColor1;
    else if (vNormal.x < 0.0 && vNormal.y == 0.0 && vNormal.z == 0.0 || 
    vNormal.x > 0.0 && vNormal.y == 0.0 && vNormal.z == 0.0) // partes à esquerda
        fColor = uColor2;
    else if (vNormal.x == 0.0 && vNormal.y == 0.0 && vNormal.z > 0.0 || 
    vNormal.x == 0.0 && vNormal.y == 0.0 && vNormal.z < 0.0)   // partes à direita
        fColor = uColor3;
    else if (vNormal.x < 0.0 && vNormal.y < 0.0 && vNormal.z > 0.0)
        fColor = uColor4;
    else if (vNormal.x < 0.0 && vNormal.y < 0.0 && vNormal.z < 0.0)
        fColor = uColor5;
    else 
        fColor = uColor6;
        
}
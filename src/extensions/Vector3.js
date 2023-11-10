
import * as THREE from "../../libs/three.js/build/three.module.js";

THREE.Vector3.prototype.toString = function () {
  return '(' + this.x + ', ' + this.y + ', ' + this.z + ')';
};

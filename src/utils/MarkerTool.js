
import * as THREE from "../../libs/three.js/build/three.module.js";
import {Marker} from "../Marker.js";
import {Utils} from "../utils.js";
import {CameraMode} from "../defines.js";
import {EventDispatcher} from "../EventDispatcher.js";

export class MarkerTool extends EventDispatcher{
	constructor (viewer) {
		super();

		this.viewer = viewer;
		this.renderer = viewer.renderer;

		this.sg = new THREE.SphereGeometry(0.1);
		this.sm = new THREE.MeshNormalMaterial();
		this.s = new THREE.Mesh(this.sg, this.sm);
	}

	startInsertion (args = {}) {
		let domElement = this.viewer.renderer.domElement;

		let marker = new Marker({
			position: [589748.270, 231444.540, 753.675],
			title: "Annotation Title",
			description: `Annotation Description`,
			onRemove: ()=>{
				markers.remove(marker);
			}
		});
		marker.doneCallback = args.callback;
		this.dispatchEvent({type: 'start_inserting_marker', marker: marker});

		const markers = this.viewer.scene.markers;
		markers.add(marker);

		let callbacks = {
			cancel: null,
			finish: null,
		};

		let insertionCallback = (e) => {
			if (e.button === THREE.MOUSE.LEFT) {
				callbacks.finish();
			} else if (e.button === THREE.MOUSE.RIGHT) {
				callbacks.cancel();
			}
		};

		if(marker.doneCallback) {
			marker.doneCallback();
		}

		callbacks.cancel = e => {
			markers.remove(marker);

			domElement.removeEventListener('mouseup', insertionCallback, true);
		};

		callbacks.finish = e => {
			domElement.removeEventListener('mouseup', insertionCallback, true);
		};

		domElement.addEventListener('mouseup', insertionCallback, true);

		let drag = (e) => {
			let I = Utils.getMousePointCloudIntersection(
				e.drag.end, 
				e.viewer.scene.getActiveCamera(), 
				e.viewer, 
				e.viewer.scene.pointclouds,
				{pickClipped: true});

			if (I) {
				this.s.position.copy(I.location);

				marker.position.copy(I.location);
			}
		};

		let drop = (e) => {
			this.viewer.scene.scene.remove(this.s);
			this.s.removeEventListener("drag", drag);
			this.s.removeEventListener("drop", drop);
		};

		this.s.addEventListener('drag', drag);
		this.s.addEventListener('drop', drop);

		this.viewer.scene.scene.add(this.s);
		this.viewer.inputHandler.startDragging(this.s);

		return marker;
	}
	

	createMarker (args = {}) {
		let domElement = this.viewer.renderer.domElement;

		let marker = new Marker({
			position: args.position,
			description: args.description,
			onRemove: ()=>{
				markers.remove(marker);
			}
		});
		marker.doneCallback = args.callback;
		this.dispatchEvent({type: 'start_inserting_marker', marker: marker});

		const markers = this.viewer.scene.markers;
		markers.add(marker);
	}

	update(){
		// let camera = this.viewer.scene.getActiveCamera();
		// let domElement = this.renderer.domElement;
		// let measurements = this.viewer.scene.measurements;

		// const renderAreaSize = this.renderer.getSize(new THREE.Vector2());
		// let clientWidth = renderAreaSize.width;
		// let clientHeight = renderAreaSize.height;

	}

	render(){
		//this.viewer.renderer.render(this.scene, this.viewer.scene.getActiveCamera());
	}
};

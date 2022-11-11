
import * as THREE from "../../libs/three.js/build/three.module.js";
import {Annotation} from "../Annotation.js";
import {Marker} from "../Marker.js";
import {CameraMode} from "../defines.js";
import {View} from "./View.js";
import {Utils} from "../utils.js";
import {EventDispatcher} from "../EventDispatcher.js";


export class Scene extends EventDispatcher{

	constructor(){
		super();

		this.annotations = new Annotation();
		this.markers = new Marker();
		
		this.scene = new THREE.Scene();
		this.sceneBG = new THREE.Scene();
		this.scenePointCloud = new THREE.Scene();

		this.cameraP = new THREE.PerspectiveCamera(this.fov, 1, 0.1, 1000*1000);
		this.cameraO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000*1000);
		this.cameraVR = new THREE.PerspectiveCamera();
		this.cameraBG = new THREE.Camera();
		this.cameraScreenSpace = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
		this.cameraMode = CameraMode.PERSPECTIVE;
		this.overrideCamera = null;
		this.pointclouds = [];

		this.shapefiles = [];
		this.measurements = [];
		this.profiles = [];
		this.volumes = [];
		this.polygonClipVolumes = [];
		this.cameraAnimations = [];
		this.orientedImages = [];
		this.images360 = [];
		this.geopackages = [];
		
		this.fpControls = null;
		this.orbitControls = null;
		this.earthControls = null;
		this.geoControls = null;
		this.deviceControls = null;
		this.inputHandler = null;

		this.view = new View();

		this.directionalLight = null;

		this.initialize();
	}

	estimateHeightAt (position) {
		let height = null;
		let fromSpacing = Infinity;

		for (let pointcloud of this.pointclouds) {
			if (pointcloud.root.geometryNode === undefined) {
				continue;
			}

			let pHeight = null;
			let pFromSpacing = Infinity;

			let lpos = position.clone().sub(pointcloud.position);
			lpos.z = 0;
			let ray = new THREE.Ray(lpos, new THREE.Vector3(0, 0, 1));

			let stack = [pointcloud.root];
			while (stack.length > 0) {
				let node = stack.pop();
				let box = node.getBoundingBox();

				let inside = ray.intersectBox(box);

				if (!inside) {
					continue;
				}

				let h = node.geometryNode.mean.z +
					pointcloud.position.z +
					node.geometryNode.boundingBox.min.z;

				if (node.geometryNode.spacing <= pFromSpacing) {
					pHeight = h;
					pFromSpacing = node.geometryNode.spacing;
				}

				for (let index of Object.keys(node.children)) {
					let child = node.children[index];
					if (child.geometryNode) {
						stack.push(node.children[index]);
					}
				}
			}

			if (height === null || pFromSpacing < fromSpacing) {
				height = pHeight;
				fromSpacing = pFromSpacing;
			}
		}

		return height;
	}
	
	getBoundingBox(pointclouds = this.pointclouds){
		let box = new THREE.Box3();

		this.scenePointCloud.updateMatrixWorld(true);
		this.referenceFrame.updateMatrixWorld(true);

		for (let pointcloud of pointclouds) {
			pointcloud.updateMatrixWorld(true);

			let pointcloudBox = pointcloud.pcoGeometry.tightBoundingBox ? pointcloud.pcoGeometry.tightBoundingBox : pointcloud.boundingBox;
			let boxWorld = Utils.computeTransformedBoundingBox(pointcloudBox, pointcloud.matrixWorld);
			box.union(boxWorld);
		}

		return box;
	}

	addPointCloud (pointcloud) {
		this.pointclouds.push(pointcloud);
		this.scenePointCloud.add(pointcloud);

		this.dispatchEvent({
			type: 'pointcloud_added',
			pointcloud: pointcloud
		});
	}

	removePointCloud (pointcloud) {
		let index = this.pointclouds.indexOf(pointcloud);
		if (index > -1) {
			this.pointclouds.splice(index, 1);
			this.scenePointCloud.remove(pointcloud);
			this.dispatchEvent({
				'type': 'pointcloud_removed',
				'scene': this,
				'pointcloud': pointcloud
			});
		}
	}

	removeAllPointClouds(){
		while (this.pointclouds.length > 0) {
			this.removePointCloud(this.pointclouds[0]);
		}
	}

	addShapefile (shapefile) {
		this.shapefiles.push(shapefile);
		this.scene.add(shapefile);

		this.dispatchEvent({
			type: 'shapefile_added',
			shapefile: shapefile
		});
	}

	removeShapefile (shapefile) {
		let index = this.shapefiles.indexOf(shapefile);
		if (index > -1) {
			this.shapefiles.splice(index, 1);
			this.scene.remove(shapefile);
			this.dispatchEvent({
				'type': 'shapefile_removed',
				'scene': this,
				'shapefile': shapefile
			});
		}
	}

	removeAllShapefiles(){
		while (this.shapefiles.length > 0) {
			this.removeShapefile(this.shapefiles[0]);
		}
	}

	addVolume (volume) {
		this.volumes.push(volume);
		this.dispatchEvent({
			'type': 'volume_added',
			'scene': this,
			'volume': volume
		});
	}

	addOrientedImages(images){
		this.orientedImages.push(images);
		this.scene.add(images.node);

		this.dispatchEvent({
			'type': 'oriented_images_added',
			'scene': this,
			'images': images
		});
	};

	removeOrientedImages(images){
		let index = this.orientedImages.indexOf(images);
		if (index > -1) {
			this.orientedImages.splice(index, 1);

			this.dispatchEvent({
				'type': 'oriented_images_removed',
				'scene': this,
				'images': images
			});
		}
	};

	add360Images(images){
		this.images360.push(images);
		this.scene.add(images.node);

		this.dispatchEvent({
			'type': '360_images_added',
			'scene': this,
			'images': images
		});
	}

	remove360Images(images){
		let index = this.images360.indexOf(images);
		if (index > -1) {
			this.images360.splice(index, 1);

			this.dispatchEvent({
				'type': '360_images_removed',
				'scene': this,
				'images': images
			});
		}
	}

	addGeopackage(geopackage){
		this.geopackages.push(geopackage);
		this.scene.add(geopackage.node);

		this.dispatchEvent({
			'type': 'geopackage_added',
			'scene': this,
			'geopackage': geopackage
		});
	};

	removeGeopackage(geopackage){
		let index = this.geopackages.indexOf(geopackage);
		if (index > -1) {
			this.geopackages.splice(index, 1);

			this.dispatchEvent({
				'type': 'geopackage_removed',
				'scene': this,
				'geopackage': geopackage
			});
		}
	};

	removeVolume (volume) {
		let index = this.volumes.indexOf(volume);
		if (index > -1) {
			this.volumes.splice(index, 1);

			this.dispatchEvent({
				'type': 'volume_removed',
				'scene': this,
				'volume': volume
			});
		}
	};

	addCameraAnimation(animation) {
		this.cameraAnimations.push(animation);
		this.dispatchEvent({
			'type': 'camera_animation_added',
			'scene': this,
			'animation': animation
		});
	};

	removeCameraAnimation(animation){
		let index = this.cameraAnimations.indexOf(volume);
		if (index > -1) {
			this.cameraAnimations.splice(index, 1);

			this.dispatchEvent({
				'type': 'camera_animation_removed',
				'scene': this,
				'animation': animation
			});
		}
	};

	addPolygonClipVolume(volume){
		this.polygonClipVolumes.push(volume);
		this.dispatchEvent({
			"type": "polygon_clip_volume_added",
			"scene": this,
			"volume": volume
		});
	};
	
	removePolygonClipVolume(volume){
		let index = this.polygonClipVolumes.indexOf(volume);
		if (index > -1) {
			this.polygonClipVolumes.splice(index, 1);
			this.dispatchEvent({
				"type": "polygon_clip_volume_removed",
				"scene": this,
				"volume": volume
			});
		}
	};
	
	addMeasurement(measurement){
		measurement.lengthUnit = this.lengthUnit;
		measurement.lengthUnitDisplay = this.lengthUnitDisplay;
		this.measurements.push(measurement);
		this.dispatchEvent({
			'type': 'measurement_added',
			'scene': this,
			'measurement': measurement
		});
	};

	removeMeasurement (measurement) {
		let index = this.measurements.indexOf(measurement);
		if (index > -1) {
			this.measurements.splice(index, 1);
			this.dispatchEvent({
				'type': 'measurement_removed',
				'scene': this,
				'measurement': measurement
			});
		}
	}

	addProfile (profile) {
		this.profiles.push(profile);
		this.dispatchEvent({
			'type': 'profile_added',
			'scene': this,
			'profile': profile
		});
	}

	removeProfile (profile) {
		let index = this.profiles.indexOf(profile);
		if (index > -1) {
			this.profiles.splice(index, 1);
			this.dispatchEvent({
				'type': 'profile_removed',
				'scene': this,
				'profile': profile
			});
		}
	}

	removeAllMeasurements () {
		while (this.measurements.length > 0) {
			this.removeMeasurement(this.measurements[0]);
		}

		while (this.profiles.length > 0) {
			this.removeProfile(this.profiles[0]);
		}

		while (this.volumes.length > 0) {
			this.removeVolume(this.volumes[0]);
		}
	}

	removeAllClipVolumes(){
		let clipVolumes = this.volumes.filter(volume => volume.clip === true);
		for(let clipVolume of clipVolumes){
			this.removeVolume(clipVolume);
		}

		while(this.polygonClipVolumes.length > 0){
			this.removePolygonClipVolume(this.polygonClipVolumes[0]);
		}
	}

	getActiveCamera() {

		if(this.overrideCamera){
			return this.overrideCamera;
		}

		if(this.cameraMode === CameraMode.PERSPECTIVE){
			return this.cameraP;
		}else if(this.cameraMode === CameraMode.ORTHOGRAPHIC){
			return this.cameraO;
		}else if(this.cameraMode === CameraMode.VR){
			return this.cameraVR;
		}

		return null;
	}
	
	initialize(){
		
		this.referenceFrame = new THREE.Object3D();
		this.referenceFrame.matrixAutoUpdate = false;
		this.scenePointCloud.add(this.referenceFrame);

		this.cameraP.up.set(0, 0, 1);
		this.cameraP.position.set(1000, 1000, 1000);
		this.cameraO.up.set(0, 0, 1);
		this.cameraO.position.set(1000, 1000, 1000);
		//this.camera.rotation.y = -Math.PI / 4;
		//this.camera.rotation.x = -Math.PI / 6;
		this.cameraScreenSpace.lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
		
		this.directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
		this.directionalLight.position.set( 10, 10, 10 );
		this.directionalLight.lookAt( new THREE.Vector3(0, 0, 0));
		this.scenePointCloud.add( this.directionalLight );
		
		let light = new THREE.AmbientLight( 0x555555 ); // soft white light
		this.scenePointCloud.add( light );

		{ // background
			let texture = Utils.createBackgroundTexture(512, 512);

			texture.minFilter = texture.magFilter = THREE.NearestFilter;
			texture.minFilter = texture.magFilter = THREE.LinearFilter;
			let bg = new THREE.Mesh(
				new THREE.PlaneBufferGeometry(2, 2, 1),
				new THREE.MeshBasicMaterial({
					map: texture
				})
			);
			bg.material.depthTest = false;
			bg.material.depthWrite = false;
			this.sceneBG.add(bg);
		}

		// { // lights
		// 	{
		// 		let light = new THREE.DirectionalLight(0xffffff);
		// 		light.position.set(10, 10, 1);
		// 		light.target.position.set(0, 0, 0);
		// 		this.scene.add(light);
		// 	}

		// 	{
		// 		let light = new THREE.DirectionalLight(0xffffff);
		// 		light.position.set(-10, 10, 1);
		// 		light.target.position.set(0, 0, 0);
		// 		this.scene.add(light);
		// 	}

		// 	{
		// 		let light = new THREE.DirectionalLight(0xffffff);
		// 		light.position.set(0, -10, 20);
		// 		light.target.position.set(0, 0, 0);
		// 		this.scene.add(light);
		// 	}
		// }
	}
	
	addAnnotation(position, args = {}){		
		if(position instanceof Array){
			args.position = new THREE.Vector3().fromArray(position);
		} else if (position.x != null) {
			args.position = position;
		}
		let annotation = new Annotation(args);
		this.annotations.add(annotation);

		return annotation;
	}

	getAnnotations () {
		return this.annotations;
	};

	removeAnnotation(annotationToRemove) {
		this.annotations.remove(annotationToRemove);
	}

	removeAllAnnotations(){
		while (this.annotations.length > 0) {
			this.removeAnnotation(this.annotations[0]);
		}
	}
	
	addMarker(position, args = {}){		
		if(position instanceof Array){
			args.position = new THREE.Vector3().fromArray(position);
		} else if (position.x != null) {
			args.position = position;
		}
		let marker = new Marker(args);
		this.markers.add(marker);

		return marker;
	}

	getMarkers () {
		return this.markers;
	};

	removeMarker(markerToRemove) {
		this.markers.remove(markerToRemove);
	}

	removeAllMarkers(){
		while (this.markers.length > 0) {
			this.removeMarker(this.markers[0]);
		}
	}

	clear(){
		this.removeAllPointClouds();
		this.removeAllShapefiles();
		this.removeAllMeasurements();
		this.removeAllClipVolumes();
		this.removeAllAnnotations();
		this.removeAllMarkers();


		//while(this.scene.children.length > 0){ 
		//    this.scene.remove(this.scene.children[0]); 
		//}
	}
};

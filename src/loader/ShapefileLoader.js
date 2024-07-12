
import * as THREE from "../../libs/three.js/build/three.module.js";
import {Line2} from "../../libs/three.js/lines/Line2.js";
import {LineGeometry} from "../../libs/three.js/lines/LineGeometry.js";
import {LineMaterial} from "../../libs/three.js/lines/LineMaterial.js";

export class ShapefileLoader{

	constructor(){
		this.transform = null;
	}

	async load(path, projData, sceneProj){

		const matLine = new LineMaterial( {
			color: 0xff0000,
			linewidth: 3, // in pixels
			resolution:  new THREE.Vector2(1000, 1000),
			dashed: false
		} );

		//const projData = await this.loadShapefilePrjData(path); 
		this.transform = this.getShapefilePrjTransform(projData, sceneProj); 

		const features = await this.loadShapefileFeatures(path);
		const node = new THREE.Object3D();
		
		const childBoundingBoxes = [];
		
		for(const feature of features){
			const fnode = this.featureToSceneNode(feature, matLine);
			node.add(fnode);
			if (fnode.boundingBox) {
				childBoundingBoxes.push(fnode.boundingBox.clone()); // Clone to avoid modifying original boxes.
			}
		}
		const overallBoundingBox = new THREE.Box3();
		for (const childBoundingBox of childBoundingBoxes) {
			overallBoundingBox.union(childBoundingBox);
		}

		node.boundingBox = overallBoundingBox;

		let setResolution = (x, y) => {
			matLine.resolution.set(x, y);
		};

		const result = {
			features: features,
			node: node,
			setResolution: setResolution,
		};

		return result;
	}

	featureToSceneNode(feature, matLine){
		let geometry = feature.geometry;
		
		let color = new THREE.Color(1, 1, 1);

		let transform = this.transform;
		if(transform === null){
			transform = {forward: (v) => v};
		}

		let node;
		let boundingBox = new THREE.Box3();
		
		if(feature.geometry.type === "Point"){
			let sg = new THREE.SphereGeometry(1, 18, 18);
			let sm = new THREE.MeshNormalMaterial();
			let s = new THREE.Mesh(sg, sm);
			
			let [long, lat] = geometry.coordinates;
			let pos = transform.forward([long, lat]);
			
			s.position.set(...pos, 20);
			
			s.scale.set(10, 10, 10);
			
			let min = new THREE.Vector3(...pos, 20).clone().sub(new THREE.Vector3(10, 10, 10));
			let max = new THREE.Vector3(...pos, 20).clone().add(new THREE.Vector3(10, 10, 10));
			boundingBox.set(min, max);
			node = s;
		}else if(geometry.type === "LineString"){
			let coordinates = [];
			
			let min = new THREE.Vector3(Infinity, Infinity, Infinity);
        	let max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
			for(let i = 0; i < geometry.coordinates.length; i++){
				let [long, lat] = geometry.coordinates[i];
				let pos = transform.forward([long, lat]);
				
				min.x = Math.min(min.x, pos[0]);
				min.y = Math.min(min.y, pos[1]);
				min.z = Math.min(min.z, 20);

                max.x = Math.max(max.x, pos[0]);
                max.y = Math.max(max.y, pos[1]);
                max.z = Math.max(max.z, pos[2]);
				
				coordinates.push(...pos, 20);
				if(i > 0 && i < geometry.coordinates.length - 1){
					coordinates.push(...pos, 20);
				}
			}
			
			for(let i = 0; i < coordinates.length; i += 3){
				coordinates[i+0] -= min.x;
				coordinates[i+1] -= min.y;
				coordinates[i+2] -= min.z;
			}
			
			const lineGeometry = new LineGeometry();
			lineGeometry.setPositions( coordinates );

			const line = new Line2( lineGeometry, matLine );
			line.computeLineDistances();
			line.scale.set( 1, 1, 1 );
			line.position.copy(min);
			
			boundingBox.set(min, max);
			node = line;
		}else if(geometry.type === "LineStringZ"){
				let coordinates = [];
				
				let min = new THREE.Vector3(Infinity, Infinity, Infinity);
				let max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
				for(let i = 0; i < geometry.coordinates.length; i++){
					let [long, lat, height] = geometry.coordinates[i];
					let pos = transform.forward([long, lat, height]);
					
					min.x = Math.min(min.x, pos[0]);
					min.y = Math.min(min.y, pos[1]);
					min.z = Math.min(min.z, pos[2]);

					max.x = Math.max(max.x, pos[0]);
					max.y = Math.max(max.y, pos[1]);
					max.z = Math.max(max.z, pos[2]);
					
					coordinates.push(...pos);
					if(i > 0 && i < geometry.coordinates.length - 1){
						coordinates.push(...pos);
					}
				}
				
				for(let i = 0; i < coordinates.length; i += 3){
					coordinates[i+0] -= min.x;
					coordinates[i+1] -= min.y;
					coordinates[i+2] -= min.z;
				}
				
				const lineGeometry = new LineGeometry();
				lineGeometry.setPositions( coordinates );
				const line = new Line2( lineGeometry, matLine );
				line.computeLineDistances();
				line.scale.set( 1, 1, 1 );
				line.position.copy(min);
			
				boundingBox.set(min, max);
				node = line;
		}else if(geometry.type === "MultiLineStringZ"){
				let coordinates = [];
				
				let min = new THREE.Vector3(Infinity, Infinity, Infinity);
				let max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
				for(let pc of geometry.coordinates){
					for(let i = 0; i < pc.length; i++){
						let [long, lat, height] = pc[i];
						let pos = transform.forward([long, lat, height]);

						min.x = Math.min(min.x, pos[0]);
						min.y = Math.min(min.y, pos[1]);
						min.z = Math.min(min.z, pos[2]);

						max.x = Math.max(max.x, pos[0]);
						max.y = Math.max(max.y, pos[1]);
						max.z = Math.max(max.z, pos[2]);

						coordinates.push(...pos);
						if(i > 0 && i < pc.length - 1){
							coordinates.push(...pos);
						}
					}
				}
				
				for(let i = 0; i < coordinates.length; i += 3){
					coordinates[i+0] -= min.x;
					coordinates[i+1] -= min.y;
					coordinates[i+2] -= min.z;
				}
				
				const lineGeometry = new LineGeometry();
				lineGeometry.setPositions( coordinates );
				const line = new Line2( lineGeometry, matLine );
				line.computeLineDistances();
				line.scale.set( 1, 1, 1 );
				line.position.copy(min);

				boundingBox.set(min, max);
				node = line;
		}else if(geometry.type === "Polygon"){
			for(let pc of geometry.coordinates){
				let coordinates = [];
				
				let min = new THREE.Vector3(Infinity, Infinity, Infinity);
				let max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
				for(let i = 0; i < pc.length; i++){
					let [long, lat] = pc[i];
					let pos = pc[i].length > 2?transform.forward([long, lat, pc[i][2]]):transform.forward([long, lat,20]);
					
					min.x = Math.min(min.x, pos[0]);
					min.y = Math.min(min.y, pos[1]);
					min.z = Math.min(min.z, pos[2]);

					max.x = Math.max(max.x, pos[0]);
					max.y = Math.max(max.y, pos[1]);
					max.z = Math.max(max.z, pos[2]);
					
					coordinates.push(...pos);
					if(i > 0 && i < pc.length - 1){
						coordinates.push(...pos);
					}
				}
				
				for(let i = 0; i < coordinates.length; i += 3){
					coordinates[i+0] -= min.x;
					coordinates[i+1] -= min.y;
					coordinates[i+2] -= min.z;
				}

				const lineGeometry = new LineGeometry();
				lineGeometry.setPositions( coordinates );
				lineGeometry.computeBoundingBox();
				lineGeometry.computeBoundingSphere();

				const line = new Line2( lineGeometry, matLine );
				line.computeLineDistances();
				line.scale.set( 1, 1, 1 );
				line.position.copy(min);

				boundingBox.set(min, max);
				node = line;
			}
		}else if(geometry.type === "MultiPolygon"){
			let coordinates = [];
			let min = new THREE.Vector3(Infinity, Infinity, Infinity);
			let max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
			for(let pcExternal of geometry.coordinates){
				for(let pc of pcExternal){
					//console.log("Parsing pc " + JSON.stringify(pc));

					for(let i = 0; i < pc.length; i++){
						let [long, lat] = pc[i];
						let pos = pc[i].length > 2?transform.forward([long, lat, pc[i][2]]):transform.forward([long, lat,20]);
					
						min.x = Math.min(min.x, pos[0]);
						min.y = Math.min(min.y, pos[1]);
						min.z = Math.min(min.z, pos[2]);

						max.x = Math.max(max.x, pos[0]);
						max.y = Math.max(max.y, pos[1]);
						max.z = Math.max(max.z, pos[2]);
					
						coordinates.push(...pos);
						if(i > 0 && i < pc.length - 1){
							coordinates.push(...pos);
						}
					}
				}
			}

			for(let i = 0; i < coordinates.length; i += 3){
				coordinates[i+0] -= min.x;
				coordinates[i+1] -= min.y;
				coordinates[i+2] -= min.z;
			}
			const lineGeometry = new LineGeometry();
			lineGeometry.setPositions( coordinates );
			const line = new Line2( lineGeometry, matLine );
			line.computeLineDistances();
			line.scale.set( 1, 1, 1 );
			line.position.copy(min);

			boundingBox.set(min, max);
			node = line;
		}else{
			console.log("unhandled feature: ", feature);
		}
		node.boundingBox = boundingBox;

    	return node;
	}

	async loadShapefileFeatures(file){
		let features = [];

		let source = await shapefile.open(file);

		while(true){
			let result = await source.read();

			if (result.done) {
				break;
			}

			if (result.value && result.value.type === 'Feature' && result.value.geometry !== undefined) {
				features.push(result.value);
			}
		}

		return features;
	}
	
	async loadShapefilePrjData(shpFileUrl) {
      // Determine the URL for the .prj file based on the provided .shp file URL.
      const prjFileUrl = shpFileUrl.replace(/\.shp$/, '.prj');
  
      try {
        // Use fetch to retrieve the .prj file content from the URL.
        const response = await fetch(prjFileUrl);
  
        if (!response.ok) {
          throw new Error(`Failed to fetch .prj file. Status: ${response.status}`);
        }
  
        // Read the .prj file content as text.
        const prjData = await response.text();
  
        // Parse the projection information from the .prj file content.
        //const projection = this.parsePrjContent(prjData);
	    //console.log("projection: " + projection);
  
        return prjData;
      } catch (error) {
        // Handle any errors that occur during fetching or parsing.
        console.error('Error loading .prj file:', error);
        return null; // Return null to indicate failure or absence of projection.
      }
	}

	getShapefilePrjTransform(prjData, sceneProj) {
      try {
		if(!sceneProj)
			sceneProj = '+proj=tmerc +lat_0=42.5 +lon_0=-72.5 +k=0.999964286 +x_0=500000.00001016 +y_0=0 +ellps=GRS80 +units=ft +no_defs';
	    const crs = proj4(prjData, sceneProj);
  
        // Create a Proj4 transform to WGS84 using the parsed projection.
        //const transformToWGS84 = proj4(projection).inverse;
  
        return crs;
      } catch (error) {
        // Handle any errors that occur during fetching or parsing.
        console.error('Error creating transform:', error);
        return null; // Return null to indicate failure or absence of projection.
      }
	}

  	// Parse the projection information from the .prj file content.
  	parsePrjContent(prjContent) {
  	  // Use regex to extract the WKT projection information from the content.
  	  const wktMatch = prjContent.match(/PROJCS\["(.*?)",/);

  	  if (wktMatch && wktMatch[1]) {
  	    return wktMatch[1]; // Return the extracted WKT projection information.
  	  }

  	  // If parsing fails, return null.
  	  return null;
  	}
};


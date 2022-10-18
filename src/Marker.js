

import * as THREE from "../libs/three.js/build/three.module.js";
import {Action} from "./Actions.js";
import {Utils} from "./utils.js";
import {EventDispatcher} from "./EventDispatcher.js";

export class Marker extends EventDispatcher {
	constructor (args = {}) {
		super();

		this.scene = null;
		this._description = args.description || '';
		this.offset = new THREE.Vector3();
		this.uuid = THREE.Math.generateUUID();

		if (!args.position) {
			this.position = null;
		} else if (args.position.x != null) {
			this.position = args.position;
		} else {
			this.position = new THREE.Vector3(...args.position);
		}

		this.cameraPosition = (args.cameraPosition instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraPosition) : args.cameraPosition;
		this.cameraTarget = (args.cameraTarget instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraTarget) : args.cameraTarget;
		this.radius = args.radius;
		this.view = args.view || null;
		this.descriptionVisible = false;
		this.showDescription = true;
		this.actions = args.actions || [];
		this.isHighlighted = false;
		this._visible = true;
		this.__visible = true;
		this._display = true;
		this._expand = false;
		this.collapseThreshold = [args.collapseThreshold, 100].find(e => e !== undefined);

		this.children = [];
		this.parent = null;
		this.boundingBox = new THREE.Box3();

		let iconClose = exports.resourcePath + '/icons/close.svg';
		let iconAnnotation = exports.resourcePath + '/icons/annotation.svg';

		this.domElement = $(`
			<div class="marker" oncontextmenu="return false;">
				<div class="marker-icon-container">
					<img class="marker-icon" src="${iconAnnotation}" width="32px">
				</div>
				<div class="marker-description">
					<span class="marker-description-content">${this._description}</span>
				</div>
			</div>
		`);

		this.elTitlebar = this.domElement.find('.marker-icon');
		this.elDescription = this.domElement.find('.marker-description');
		this.elDescriptionContent = this.elDescription.find(".marker-description-content");
		this.elDescriptionInput = this.domElement.find('.marker-description-input');

		this.actions = this.actions.map(a => {
			if (a instanceof Action) {
				return a;
			} else {
				return new Action(a);
			}
		});

		for (let action of this.actions) {
			action.pairWith(this);
		}

		let actions = this.actions.filter(
			a => a.showIn === undefined || a.showIn.includes('scene'));

		for (let action of actions) {
			let elButton = $(`<img src="${action.icon}" class="marker-action-icon">`);
			elButton.click(() => action.onclick({annotation: this}));
		}

		this.clickDescription = () => {
			this.elDescriptionInput.val(this._description);
			this.elDescriptionContent.css('display', 'none');
			this.elDescriptionInput.css('display', 'inline-block');
			this.elDescriptionInput.focus();
			this.dispatchEvent({type: 'click', target: this});
		};
		//this.elDescriptionContent.click(this.clickDescription);
		this.elDescriptionInput.blur(()=>{
			this.description = this.elDescriptionInput.val();
			this.elDescriptionContent.css('display', 'inline-block');
			this.elDescriptionInput.css('display', 'none');
		});

		this.domElement.mouseenter(e => this.setHighlighted(true));
		this.domElement.mouseleave(e => this.setHighlighted(false));

		this.domElement.on('touchstart', e => {
			this.setHighlighted(!this.isHighlighted);
		});

		this.display = false;
	}

	installHandles(viewer){
		if(this.handles !== undefined){
			return;
		}

		let domElement = $(`
			<div style="position: absolute; left: 300; top: 200; pointer-events: none">
				<svg width="300" height="600">
					<line x1="0" y1="0" x2="1200" y2="200" style="stroke: black; stroke-width:2" />
					<circle cx="50" cy="50" r="4" stroke="black" stroke-width="2" fill="gray" />
					<circle cx="150" cy="50" r="4" stroke="black" stroke-width="2" fill="gray" />
				</svg>
			</div>
		`);
		
		let svg = domElement.find("svg")[0];
		let elLine = domElement.find("line")[0];
		let elStart = domElement.find("circle")[0];
		let elEnd = domElement.find("circle")[1];

		let setCoordinates = (start, end) => {
			elStart.setAttribute("cx", `${start.x}`);
			elStart.setAttribute("cy", `${start.y}`);

			elEnd.setAttribute("cx", `${end.x}`);
			elEnd.setAttribute("cy", `${end.y}`);

			elLine.setAttribute("x1", start.x);
			elLine.setAttribute("y1", start.y);
			elLine.setAttribute("x2", end.x);
			elLine.setAttribute("y2", end.y);

			let box = svg.getBBox();
			svg.setAttribute("width", `${box.width}`);
			svg.setAttribute("height", `${box.height}`);
			svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);

			let ya = start.y - end.y;
			let xa = start.x - end.x;

			if(ya > 0){
				start.y = start.y - ya;
			}
			if(xa > 0){
				start.x = start.x - xa;
			}

			domElement.css("left", `${start.x}px`);
			domElement.css("top", `${start.y}px`);

		};

		$(viewer.renderArea).append(domElement);

		let updateCallback = () => {
			let position = this.position;
			let scene = viewer.scene;

			const renderAreaSize = viewer.renderer.getSize(new THREE.Vector2());
			let renderAreaWidth = renderAreaSize.width;
			let renderAreaHeight = renderAreaSize.height;

			let start = this.position.clone();
			let end = new THREE.Vector3().addVectors(this.position, this.offset);

			let toScreen = (position) => {
				let camera = scene.getActiveCamera();
				let screenPos = new THREE.Vector3();

				let worldView = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
				let ndc = new THREE.Vector4(position.x, position.y, position.z, 1.0).applyMatrix4(worldView);
				// limit w to small positive value, in case position is behind the camera
				ndc.w = Math.max(ndc.w, 0.1);
				ndc.divideScalar(ndc.w);

				screenPos.copy(ndc);
				screenPos.x = renderAreaWidth * (screenPos.x + 1) / 2;
				screenPos.y = renderAreaHeight * (1 - (screenPos.y + 1) / 2);

				return screenPos;
			};
			
			start = toScreen(start);
			end = toScreen(end);

			setCoordinates(start, end);

		};

		viewer.addEventListener("update", updateCallback);

		this.handles = {
			domElement: domElement,
			setCoordinates: setCoordinates,
			updateCallback: updateCallback
		};
	}

	removeHandles(viewer){
		if(this.handles === undefined){
			return;
		}

		//$(viewer.renderArea).remove(this.handles.domElement);
		this.handles.domElement.remove();
		viewer.removeEventListener("update", this.handles.updateCallback);

		delete this.handles;
	}

	get visible () {
		return this._visible;
	}

	set visible (value) {
		if (this._visible === value) {
			return;
		}

		this._visible = value;

		//this.traverse(node => {
		//	node.display = value;
		//});

		this.dispatchEvent({
			type: 'visibility_changed',
			marker: this
		});
	}

	get display () {
		return this._display;
	}

	set display (display) {
		if (this._display === display) {
			return;
		}

		this._display = display;

		if (display) {
			// this.domElement.fadeIn(200);
			this.domElement.show();
		} else {
			// this.domElement.fadeOut(200);
			this.domElement.hide();
		}
	}

	get expand () {
		return this._expand;
	}

	set expand (expand) {
		if (this._expand === expand) {
			return;
		}

		if (expand) {
			this.display = false;
		} else {
			this.display = true;
			this.traverseDescendants(node => {
				node.display = false;
			});
		}

		this._expand = expand;
	}

	get description () {
		return this._description;
	}

	set description (description) {
		if (this._description === description) {
			return;
		}

		this._description = description;

		const elDescriptionContent = this.elDescription.find(".marker-description-content");
		elDescriptionContent.empty();
		elDescriptionContent.append(this._description);

		this.dispatchEvent({
			type: "marker_changed",
			marker: this,
		});
	}

	add (marker) {
		console.log("Adding marker");
		if (!this.children.includes(marker)) {
			this.children.push(marker);
			marker.parent = this;

			let descendants = [];
			marker.traverse(a => { descendants.push(a); });

			for (let descendant of descendants) {
				let c = this;
				while (c !== null) {
				console.log("Dispatching marker event");
					c.dispatchEvent({
						'type': 'marker_added',
						'marker': descendant
					});
					c = c.parent;
				}
			}
		}
	}

	level () {
		if (this.parent === null) {
			return 0;
		} else {
			return this.parent.level() + 1;
		}
	}

	hasChild(marker) {
		return this.children.includes(marker);
	}

	remove (marker) {
		if (this.hasChild(marker)) {
			marker.removeAllChildren();
			marker.dispose();
			this.children = this.children.filter(e => e !== marker);
			marker.parent = null;
		}
	}

	removeAllChildren() {
		this.children.forEach((child) => {
			if (child.children.length > 0) {
				child.removeAllChildren();
			}

			this.remove(child);
		});
	}

	updateBounds () {
		let box = new THREE.Box3();

		if (this.position) {
			box.expandByPoint(this.position);
		}

		for (let child of this.children) {
			child.updateBounds();

			box.union(child.boundingBox);
		}

		this.boundingBox.copy(box);
	}

	traverse (handler) {
		let expand = handler(this);

		if (expand === undefined || expand === true) {
			for (let child of this.children) {
				child.traverse(handler);
			}
		}
	}

	traverseDescendants (handler) {
		for (let child of this.children) {
			child.traverse(handler);
		}
	}

	flatten () {
		let markers = [];

		this.traverse(marker => {
			markers.push(marker);
		});

		return markers;
	}

	descendants () {
		let markers = [];

		this.traverse(marker => {
			if (marker !== this) {
				markers.push(marker);
			}
		});

		return markers;
	}

	setHighlighted (highlighted) {
		if (highlighted) {
			console.log("Highlighting marker");
			this.domElement.css('opacity', '0.8');
			//this.elTitlebar.css('box-shadow', '0 0 5px #fff');
			this.domElement.css('z-index', '1000');

			if (this._description) {
				this.descriptionVisible = true;
				this.elDescription.fadeIn(200);
				this.elDescription.css('position', 'relative');
			}
		} else {
			this.domElement.css('opacity', '0.5');
			//this.elTitlebar.css('box-shadow', '');
			this.domElement.css('z-index', '100');
			this.descriptionVisible = false;
			this.elDescription.css('display', 'none');
		}

		this.isHighlighted = highlighted;
	}

	hasView () {
		if(!this.cameraTarget) {
			return false;
		}
		let hasPosTargetView = this.cameraTarget.x != null;
		hasPosTargetView = hasPosTargetView && this.cameraPosition.x != null;

		let hasRadiusView = this.radius !== undefined;

		let hasView = hasPosTargetView || hasRadiusView;

		return hasView;
	};

	moveHere (camera) {
		if (!this.hasView()) {
			return;
		}

		let view = this.scene.view;
		let animationDuration = 500;
		let easing = TWEEN.Easing.Quartic.Out;

		let endTarget;
		if (this.cameraTarget) {
			endTarget = this.cameraTarget;
		} else if (this.position) {
			endTarget = this.position;
		} else {
			endTarget = this.boundingBox.getCenter(new THREE.Vector3());
		}

		if (this.cameraPosition) {
			let endPosition = this.cameraPosition;

			Utils.moveTo(this.scene, endPosition, endTarget);
		} else if (this.radius) {
			let direction = view.direction;
			let endPosition = endTarget.clone().add(direction.multiplyScalar(-this.radius));
			let startRadius = view.radius;
			let endRadius = this.radius;

			{ // animate camera position
				let tween = new TWEEN.Tween(view.position).to(endPosition, animationDuration);
				tween.easing(easing);
				tween.start();
			}

			{ // animate radius
				let t = {x: 0};

				let tween = new TWEEN.Tween(t)
					.to({x: 1}, animationDuration)
					.onUpdate(function () {
						view.radius = this.x * endRadius + (1 - this.x) * startRadius;
					});
				tween.easing(easing);
				tween.start();
			}
		}
	};

	dispose () {
		if (this.domElement.parentElement) {
			this.domElement.parentElement.removeChild(this.domElement);
		}
	};

	toString () {
		return 'Marker: ' + this._title;
	}
};

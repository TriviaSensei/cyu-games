export class StateHandler {
	randomString(length) {
		const chars =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';
		const randomArray = new Uint8Array(length);
		crypto.getRandomValues(randomArray);
		randomArray.forEach((number) => {
			result += chars[number % chars.length];
		});
		return result;
	}

	constructor(initialState, ...validator) {
		if ((typeof initialState).toLowerCase() === 'function')
			throw new Error('State cannot be set to a function');

		this.state = { value: initialState };

		if (validator) {
			this.validator = validator[0];
		}
		this.id = this.randomString(20);
		this.objects = [];
	}

	validateState(state) {
		return this.validator(state);
	}

	addWatcher(obj, updater) {
		if (
			obj &&
			this.objects.some((o) => {
				return o.node === obj;
			})
		)
			throw new Error('Object is already added to this state handler.');
		else if (obj && (!obj.nodeType || obj.nodeType !== Node.ELEMENT_NODE))
			throw new Error(`Object ${obj.toString()} is not a valid node`);
		this.objects.push({
			node: obj,
			updater,
		});
		if (obj) {
			obj.addEventListener(`update-state-${this.id}`, updater);
			const evt = new CustomEvent(`update-state-${this.id}`, {
				detail: this.state.value,
			});
			obj.dispatchEvent(evt);
		} else {
			updater(this.state.value);
		}
	}

	removeWatcher(obj) {
		if (!obj) return;
		else if (obj.nodeType && obj.nodeType === Node.ELEMENT_NODE)
			this.objects = this.objects.filter((o) => {
				return o !== obj;
			});
		else if ((typeof obj).toLowerCase() === 'function') {
			this.objects = this.objects.filter((o) => {
				return o.updater !== obj;
			});
		}
	}

	setState(s, ...opts) {
		if ((typeof s).toLowerCase() === 'function') {
			if (this.validator && !this.validateState(s(this.state.value)))
				throw new Error('State is invalid');
			this.state.value = s(this.state.value);
		} else {
			if (this.validator && !this.validateState(s))
				throw new Error('State is invalid');
			this.state.value = s;
		}

		if (opts.length > 0) {
			if (opts[0].runUpdates === false) return;
		}

		const evt = new CustomEvent(`update-state-${this.id}`, {
			detail: this.state.value,
		});
		this.objects.forEach((o) => {
			if (o.node) {
				if (!document.body.contains(o.node)) return this.removeWatcher(o);
				else o.node.dispatchEvent(evt);
			} else {
				o.updater(this.getState());
			}
		});
	}

	getState() {
		if (!this.state) return null;
		else return this.state.value;
	}

	refreshState() {
		this.setState(this.state.value);
	}
}

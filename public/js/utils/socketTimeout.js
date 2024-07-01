import { showMessage } from './messages.js';

export const withTimeout = (onSuccess, onTimeout, timeout) => {
	let called = false;

	const timer = setTimeout(() => {
		if (called) return;
		called = true;
		onTimeout();
	}, timeout);

	return (...args) => {
		if (called) return;
		called = true;
		clearTimeout(timer);
		onSuccess.apply(this, args);
	};
};

export const timeoutMessage = (msg) => {
	return () => {
		showMessage('error', msg);
	};
};

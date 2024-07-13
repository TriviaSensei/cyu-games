import { showMessage } from './messages.js';

export const withTimeout = (onSuccess, onTimeout, ...timeout) => {
	let called = false;

	let reqTimeout;
	if (!timeout || timeout.length === 0) reqTimeout = 1000;
	else reqTimeout = timeout[0];

	const timer = setTimeout(() => {
		if (called) return;
		called = true;
		onTimeout();
	}, reqTimeout);

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

import { handleRequest } from './utils/requestHandler.js';
import { showMessage } from './utils/messages.js';

const loginForm = document.querySelector('#login-form');
const username = document.querySelector('#name');
const password = document.querySelector('#password');
const dataArea = document.querySelector('#data-area');

let socket;

const handleLogin = (e) => {
	e.preventDefault();
	username.disabled = true;
	password.disabled = true;
	const str = `/api/v1/users/login`;
	const body = {
		username: username.value,
		password: password.value,
	};
	const handler = (res) => {
		if (res.status !== 'success') {
			username.disabled = false;
			password.disabled = false;
			return showMessage('error', res.message);
		}
		showMessage('info', 'Successfully logged in');
		setTimeout(() => {
			location.href = '/play';
		}, 1000);
	};
	handleRequest(str, 'POST', body, handler);
};

document.addEventListener('DOMContentLoaded', () => {
	const user = dataArea?.getAttribute('data-user');
	// handleRequest('/api/v1/test', 'POST', { user }, () => {});
	if (user) location.href = '/play';
	loginForm.addEventListener('submit', handleLogin);
});

import { handleRequest } from './utils/requestHandler.js';

const loginForm = document.querySelector('#login-form');
const username = document.querySelector('#name');
const password = document.querySelector('#password');

let socket;

const handleLogin = (e) => {
	e.preventDefault();
	console.log('hi');
	const str = `/api/v1/users/login`;
	const handler = (res) => {
		socket = io();
	};
};

document.addEventListener('DOMContentLoaded', () => {
	loginForm.addEventListener('submit', handleLogin);
});

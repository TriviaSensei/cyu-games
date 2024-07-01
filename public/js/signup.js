const pwConfirmSpan = document.querySelector('#pw-confirm-span');
const pwSpan = document.querySelector('#pw-span');
const pwConfirmBar = document.querySelector('.pw-confirm-validator');
const container = document.querySelector('#body-container');
const signupForm = document.querySelector('#sign-up-form');
import { handleRequest } from './utils/requestHandler.js';
import { showMessage } from './utils/messages.js';

const username = document.querySelector('#username');
const email = document.querySelector('#email');
const pw = document.querySelector('#password');
const pwConfirm = document.querySelector('#password-confirm');

const checkPasswordMatch = () => {
	const setInvalid = () => {
		pwConfirmBar.classList.remove('valid');
		pwConfirmBar.classList.add('invalid');
		pwConfirmSpan.classList.remove('valid-pw-confirm');
		pwConfirmSpan.classList.add('invalid-pw-confirm');
	};
	if (pw.value !== pwConfirm.value) {
		setInvalid();
		return;
	}

	const pseudo = window.getComputedStyle(pwSpan, ':after');
	if (pseudo.content.charCodeAt(1) === 10005) {
		setInvalid();
		return;
	}
	pwConfirmBar.classList.remove('invalid');
	pwConfirmBar.classList.add('valid');
	pwConfirmSpan.classList.remove('invalid-pw-confirm');
	pwConfirmSpan.classList.add('valid-pw-confirm');
};

document.addEventListener('DOMContentLoaded', () => {
	pw.addEventListener('keyup', checkPasswordMatch);
	pwConfirm.addEventListener('keyup', checkPasswordMatch);
	pw.addEventListener('change', checkPasswordMatch);
	pwConfirm.addEventListener('change', checkPasswordMatch);

	signupForm.addEventListener('submit', (e) => {
		e.preventDefault();

		const handler = (res) => {
			console.log(res);
			if (res.status === 'success') {
				container.innerHTML = '';
				const p = document.createElement('p.my-3');
				p.innerHTML = res.message;
				container.appendChild(p);
			} else {
				showMessage('error', res.message);
			}
		};

		const body = {
			username: username.value,
			email: email.value,
			password: pw.value,
			passwordConfirm: pwConfirm.value,
		};

		handleRequest('/api/v1/users/signup', 'POST', body, handler);
	});
});

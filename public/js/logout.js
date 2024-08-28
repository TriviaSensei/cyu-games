import { handleRequest } from './utils/requestHandler.js';
import { showMessage } from './utils/messages.js';

const logout = document.querySelector('#logout');
const profile = document.querySelector('#profile');

const gameListArea = document.querySelector('#game-list-area');

const handleLogout = () => {
	const str = `/api/v1/users/logout`;
	console.log('logging out');
	const handler = (res) => {
		if (res.status !== 'success') return showMessage(`error`, res.message);
		showMessage('info', 'Logged out');
		setTimeout(() => {
			location.href = '/';
		}, 1000);
	};
	handleRequest(str, 'GET', null, handler);
};

document.addEventListener('DOMContentLoaded', () => {
	logout.addEventListener('click', handleLogout);
	profile.addEventListener('click', () => {
		location.reload();
	});
});

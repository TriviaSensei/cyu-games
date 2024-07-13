import { handleRequest } from './utils/requestHandler.js';
import { showMessage } from './utils/messages.js';
import { createElement } from './utils/createElementFromSelector.js';

const logout = document.querySelector('#logout');
const gameListArea = document.querySelector('#game-list-area');

const handleLogout = () => {
	const str = `/api/v1/users/logout`;
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
	const socket = io();
	socket.on('game-list', (data) => {
		gameListArea.innerHTML = '';
		data.forEach((c) => {
			const header = createElement('h2.ms-3');
			header.innerHTML = c.category;
			const list = createElement('ul');
			c.games.forEach((g) => {
				const line = createElement('li');
				line.innerHTML = `<a href="/play/${g.name}">${g.displayName}</a> (${g.size})`;
				list.appendChild(line);
			});
			gameListArea.appendChild(header);
			gameListArea.appendChild(list);
		});
	});
});

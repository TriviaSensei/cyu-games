import { handleRequest } from './utils/requestHandler.js';
import { showMessage } from './utils/messages.js';

const token = document.querySelector('#token').value;

document.addEventListener('DOMContentLoaded', () => {
	if (!token) {
		showMessage('error', 'Invalid token');
		setTimeout(() => {
			location.href = '/';
		}, 1000);
	}
	const str = `/api/v1/users/activate/${token}`;
	const handler = (res) => {
		if (res.status === 'success') {
			showMessage('info', 'Successfully activated account. Stand by...', 2000);
			setTimeout(() => {
				location.href = '/play';
			}, 2000);
		} else {
			showMessage('error', res.message);
			setTimeout(() => {
				location.href = '/';
			}, 1000);
		}
	};
	handleRequest(str, 'PATCH', null, handler);
});

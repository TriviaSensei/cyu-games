import { timeoutMessage, withTimeout } from './socketTimeout.js';
import { createChatMessage } from './chatMessage.js';
import { showMessage } from './messages.js';

const lobbyChatForm = document.querySelector('#lobby-chat-form');
const lobbyChatMsg = document.querySelector('#lobby-chat-message');
const lobbyChatBox = document.querySelector('#lobby-chat-box');
const availableGameArea = document.querySelector('#available-games');
const cancelButton = document.querySelector('#cancel-game');
const gameChatForm = document.querySelector('#game-chat-form');
const gameChatMsg = document.querySelector('#game-chat-message');
const gameChatBox = document.querySelector('#game-chat-box');
const createGameModal = new bootstrap.Modal(
	document.querySelector('#create-game-modal')
);
const gameChatArea = new bootstrap.Offcanvas(
	document.querySelector('#game-chat-container')
);
const gameChatButton = document.querySelector('.game-chat-button');
const badge = document.querySelector('.game-chat-button > .badge');

const newChatMessage = (box, msg) => {
	const newMessage = createChatMessage(msg.user, msg.message);
	box.appendChild(newMessage);
	box.scrollTop = box.scrollHeight;
	return newMessage;
};

export class LobbyManager {
	handleJoinGame = (e) => {
		const matchId = e.target.closest('.game-tile')?.getAttribute('data-id');
		if (!matchId) showMessage('error', 'Game not found');
		this.socket.emit(
			'join-game',
			{ matchId },
			withTimeout(
				(data) => {
					if (data.status !== 'OK') return showMessage('error', data.message);
				},
				() => {
					showMessage('error', 'Join request timed out. Try again later.');
				}
			)
		);
	};
	cancelCreateGame = (e) => {
		this.socket.emit(
			'cancel-game',
			null,
			withTimeout(
				(data) => {
					if (data.status !== 'OK') showMessage('error', data.message);
					const tile = e.target.closest('.game-tile');
					if (tile) tile.remove();
				},
				() => {
					showMessage('error', 'Something went wrong. Please try again later.');
				}
			)
		);
	};

	createGame = (state) => {
		this.socket.emit(
			'create-game',
			state,
			withTimeout(
				(data) => {
					if (data.status === 'OK') {
						createGameModal.hide();
					} else showMessage('error', data.message);
				},
				() => {
					showMessage(
						'error',
						'The request timed out - please try again later.',
						2000
					);
				}
			)
		);
	};

	constructor(socket, createNewGameTile) {
		this.socket = socket;
		this.createNewGameTile = createNewGameTile;

		socket.on('chat-message-lobby', (data) => {
			newChatMessage(lobbyChatBox, data);
		});

		socket.on('chat-message-match', (data) => {
			newChatMessage(gameChatBox, data);
			if (!gameChatArea._element.classList.contains('show'))
				badge.classList.remove('d-none');
		});

		lobbyChatForm.addEventListener('submit', (e) => {
			e.preventDefault();
			if (lobbyChatMsg.value === '') return;
			const newMessage = newChatMessage(lobbyChatBox, {
				user: 'me',
				message: lobbyChatMsg.value,
			});
			socket.emit(
				'chat-message',
				{
					message: lobbyChatMsg.value,
				},
				withTimeout((data) => {
					if (data.status === 'OK') {
						lobbyChatMsg.value = '';
					} else {
						showMessage('error', data.message);
						newMessage.remove();
					}
				}, timeoutMessage('Message timed out. Try again.'))
			);
		});

		gameChatForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const newMessage = newChatMessage(gameChatBox, {
				user: 'me',
				message: gameChatMsg.value,
			});
			socket.emit(
				'chat-message',
				{
					message: gameChatMsg.value,
				},
				withTimeout((data) => {
					if (data.status === 'OK') {
						gameChatMsg.value = '';
					} else {
						showMessage('error', data.message);
						newMessage.remove();
					}
				}, timeoutMessage)
			);
		});

		gameChatButton.addEventListener('click', (e) => {
			if (badge) badge.classList.add('d-none');
		});

		socket.on('cancel-game', (data) => {
			const tile = availableGameArea.querySelector(
				`.game-tile[data-id="${data.id}"]`
			);
			if (tile) tile.remove();
		});

		const addGameTile = (data) => {
			const newTile = createNewGameTile(data);
			const joinBtn = newTile.querySelector('.join-button');
			joinBtn.addEventListener('click', this.handleJoinGame);
			availableGameArea.appendChild(newTile);
		};
		socket.on('available-new-game', (data) => {
			addGameTile(data);
		});

		socket.on('available-games-list', (data) => {
			availableGameArea.innerHTML = '';
			data.forEach((g) => {
				addGameTile(g);
			});
		});

		socket.on('message', (data) => {
			showMessage(data.status, data.message);
		});

		cancelButton.addEventListener('click', (e) => {
			if (!e.target.getAttribute('data-id')) return;
			socket.emit(
				'cancel-game',
				null,
				withTimeout(
					(data) => {
						if (data.status !== 'OK') showMessage('error', data.message);
					},
					() => {
						showMessage('error', 'Request timed out. Try again later.');
					}
				)
			);
		});

		socket.on('force-disconnect', () => {
			showMessage('error', 'Disconnected from server', 5000);
		});
	}
}

import { StateHandler } from '../utils/stateHandler.js';
import { getElementArray } from '../utils/getElementArray.js';
import { withTimeout, timeoutMessage } from '../utils/socketTimeout.js';
import { createChatMessage } from '../utils/chatMessage.js';
import { showMessage } from '../utils/messages.js';
import { createElement } from '../utils/createElementFromSelector.js';
import { LobbyManager } from '../utils/lobbyManager.js';

const createGameForm = document.querySelector('#create-game-form');
const startingDice = createGameForm.querySelector('#starting-dice');
const time = createGameForm.querySelector('#time');
const minPlayers = createGameForm.querySelector('#min-players');
const maxPlayers = createGameForm.querySelector('#max-players');

const createGame = document.querySelector('#create-game');

const newGameState = new StateHandler({
	game: 'liarsdice',
	time: 30,
	startingDice: 5,
	minPlayers: 2,
	maxPlayers: 4,
});

document.addEventListener('DOMContentLoaded', () => {
	const socket = io();

	[startingDice, time, minPlayers, maxPlayers].forEach((el) => {
		newGameState.addWatcher(el, (e) => {
			e.target.value = e.detail[el.getAttribute('name')];
		});
	});

	startingDice.addEventListener('change', (e) => {
		newGameState.setState((prev) => {
			return {
				...prev,
				startingDice: Number(e.target.value),
			};
		});
	});

	time.addEventListener('change', (e) => {
		newGameState.setState((prev) => {
			return {
				...prev,
				time: Number(e.target.value),
			};
		});
	});

	minPlayers.addEventListener('change', (e) => {
		const minVal = Number(e.target.getAttribute('min'));
		newGameState.setState((prev) => {
			return {
				...prev,
				minPlayers: Math.max(
					minVal,
					Math.min(prev.maxPlayers, Number(e.target.value))
				),
			};
		});
	});

	maxPlayers.addEventListener('change', (e) => {
		const maxVal = Number(e.target.getAttribute('max'));
		newGameState.setState((prev) => {
			return {
				...prev,
				maxPlayers: Math.min(
					maxVal,
					Math.max(prev.minPlayers, Number(e.target.value))
				),
			};
		});
	});

	const createNewGameTile = (data) => {
		const newTile = createElement('.game-tile');
		newTile.setAttribute('data-id', data.matchId);
		let joinBtn;

		joinBtn = createElement('button.btn.btn-primary.join-button');
		joinBtn.innerHTML = 'Join';

		const gameInfo = createElement('.game-info');
		gameInfo.innerHTML = `${data.host.user} (${data.host.rating}) ${
			data.color === 'random' ? '' : `(${data.color})`
		}<br>`;
		if (data.timer === 'game') {
			gameInfo.innerHTML =
				gameInfo.innerHTML +
				`Timer: ${data.time}min/game ${
					data.increment > 0 ? `+ ${data.increment}s/move` : ''
				}`;
		} else if (data.timer === 'move') {
			gameInfo.innerHTML =
				gameInfo.innerHTML +
				`Timer: ${data.time}min/move ${
					data.reserve > 0 ? `+ ${data.reserve}min reserve` : ''
				}`;
		} else {
			gameInfo.innerHTML = gameInfo.innerHTML + `Timer: Off`;
		}
		newTile.appendChild(gameInfo);
		newTile.appendChild(joinBtn);
		return newTile;
	};

	const lm = new LobbyManager(socket, createNewGameTile);

	const handleCreateGame = (e) => {
		const state = newGameState.getState();
		lm.createGame(state);
	};
	createGame.addEventListener('click', handleCreateGame);
});

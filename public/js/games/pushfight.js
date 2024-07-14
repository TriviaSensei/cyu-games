import { StateHandler } from '../utils/stateHandler.js';
import { getElementArray } from '../utils/getElementArray.js';
import { withTimeout, timeoutMessage } from '../utils/socketTimeout.js';
import { createChatMessage } from '../utils/chatMessage.js';
import { showMessage } from '../utils/messages.js';
import { createElement } from '../utils/createElementFromSelector.js';
import { LobbyManager } from '../utils/lobbyManager.js';

const createGameForm = document.querySelector('#create-game-form');
const radios = getElementArray(createGameForm, 'input[type="radio"]');

const time = createGameForm.querySelector('#time');
const timeAdj = createGameForm.querySelector('#adjustment');
const timeLabel = createGameForm.querySelector('#timer-setting');
const timeAdjLabel = document.querySelector('#adjustment-type');
const createGame = document.querySelector('#create-game');

const gameDiv = document.querySelector('#game-div');
const navbar = document.querySelector('#navbar-game');

const newGameState = new StateHandler({
	game: 'pushfight',
	color: 'random',
	timer: 'game',
	time: 5,
	increment: 30,
	reserve: 10,
});

const gameState = new StateHandler(null);

document.addEventListener('DOMContentLoaded', () => {
	const socket = io();

	const getSelected = (str) => {
		return (e) => {
			e.target.checked = e.detail[str] === e.target.value;
		};
	};
	radios.forEach((r) => {
		const name = r.getAttribute('name');
		newGameState.addWatcher(r, getSelected(name));
		r.addEventListener('change', (e) => {
			if (e.target.checked) {
				newGameState.setState((prev) => {
					prev[name] = e.target.value;
					return prev;
				});
			}
		});
	});

	const disableTimerFields = (e) => {
		e.target.disabled = e.detail.timer === 'off';
	};
	newGameState.addWatcher(time, disableTimerFields);
	newGameState.addWatcher(timeAdj, disableTimerFields);

	newGameState.addWatcher(timeLabel, (e) => {
		if (e.detail.timer === 'off') return;
		e.target.innerHTML = e.detail.timer;
	});

	newGameState.addWatcher(timeAdjLabel, (e) => {
		const a = e.target.parentElement.querySelector(
			'a[data-bs-toggle="tooltip"]'
		);
		if (e.detail.timer === 'game') {
			e.target.innerHTML = `Increment (sec)`;
			if (a)
				a.setAttribute(
					'data-bs-title',
					'Number of seconds to return to the timer after each turn'
				);
		} else if (e.detail.timer === 'move') {
			e.target.innerHTML = `Reserve (min)`;

			if (a)
				a.setAttribute(
					'data-bs-title',
					"Number of minutes in reserved time. If a player's move time expires, the reserve time will run. If the reserve time expires, the player forfeits the game. "
				);
		}
		if (a) new bootstrap.Tooltip(a);
	});

	newGameState.addWatcher(null, (state) => {
		time.value = state.time;
		if (state.timer === 'move') timeAdj.value = state.reserve;
		else if (state.timer === 'game') timeAdj.value = state.increment;
	});

	time.addEventListener('change', (e) => {
		const val = Number(e.target.value);
		const minVal = Number(e.target.getAttribute('min'));
		if (val < minVal)
			newGameState.setState((prev) => {
				return {
					...prev,
					time: minVal,
				};
			});
		else
			newGameState.setState((prev) => {
				return {
					...prev,
					time: val,
				};
			});
	});

	timeAdj.addEventListener('change', (e) => {
		const state = newGameState.getState();
		const attr = state.timer === 'game' ? 'increment' : 'reserve';
		const val = Number(e.target.value);
		const minVal = Number(e.target.getAttribute('min'));

		newGameState.setState((prev) => {
			prev[attr] = Math.max(minVal, val);
			return prev;
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

	//game inputs, rules, etc.
	gameState.addWatcher(navbar, (e) => {
		if (e.detail) e.target.classList.add('d-none');
		else e.target.classList.remove('d-none');
	});
	const resizeBoard = () => {
		const gb = document.querySelector('#game-board');
		const gbc = document.querySelector('#game-board-container');
		const rect = gbc.getBoundingClientRect();
		for (var i = 20; i > 0; i--) {
			const pct = i * 5;
			gb.style = `width:${pct}%;`;
			const r2 = gb.getBoundingClientRect();
			if (r2.height <= rect.height - 50 && r2.width <= rect.width - 50) break;
		}
	};
	gameState.addWatcher(gameDiv, (e) => {
		if (e.detail && e.target.classList.contains('d-none')) {
			e.target.classList.remove('d-none');
			resizeBoard();
		} else e.target.classList.add('d-none');
	});
	window.addEventListener('resize', resizeBoard);

	socket.on('update-game-state', (data) => {
		console.log(data);
		gameState.setState(data);
	});
});

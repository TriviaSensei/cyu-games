/**
 * Server-side timer manager -
 *
 */
class TimerManager {
	incrementTurn(gameState) {
		const timerSetting = gameState.players[0].timer;
		const oldTurn = this.getTurn(gameState);

		if (timerSetting === 'off') {
			return {
				...gameState,
				turnsCompleted: gameState.turnsCompleted + 1,
			};
		}

		const timeElapsed = Date.now() - gameState.players[oldTurn].turnStart;
		console.log(`${timeElapsed / 1000}s elapsed on move ${oldTurn + 1}`);

		this.gameManager.setGameState({
			turnsCompleted: gameState.turnsCompleted + 1,
			players: gameState.players.map((p, i) => {
				if (i === oldTurn)
					return {
						...p,
						time:
							settings.timer === 'game'
								? Math.max(0, p.time - timeElapsed + settings.increment)
								: settings.time,
						reserve:
							settings.timer === 'move'
								? p.reserve - Math.max(0, timeElapsed - settings.time)
								: 0,
						turnStart: null,
					};
				return {
					...p,
					turnStart: null,
				};
			}),
		});
		const turn = this.getTurn(this.gameManager.getState());
		gameState = this.gameManager.getGameState();
		this.gameManager.setGameState({
			...gameState,
			players: gameState.players.map((p, i) => {
				if (i === turn) {
					return {
						...p,
						turnStart: Date.now(),
					};
				}
			}),
		});
	}

	refreshState() {
		let gameState = this.gameManager.getGameState();
		const settings = this.gameManager.getSettings();
		const turn = this.getTurn(gameState);

		if (settings.timer === 'off') return;

		const timeElapsed = Date.now() - gameState.players[turn].turnStart;
		console.log(`${timeElapsed / 1000}s elapsed so far on move ${turn + 1}`);

		this.gameManager.setGameState({
			players: gameState.players.map((p, i) => {
				if (i === turn)
					return {
						...p,
						time:
							settings.timer === 'game'
								? Math.max(0, p.time - timeElapsed)
								: settings.time,
						reserve:
							settings.timer === 'move'
								? p.reserve - Math.max(0, timeElapsed - settings.time)
								: 0,
						turnStart: Date.now(),
					};
				return {
					...p,
					turnStart: null,
				};
			}),
		});
	}

	constructor(getTurn) {
		this.getTurn = getTurn;
	}
}

module.exports = TimerManager;

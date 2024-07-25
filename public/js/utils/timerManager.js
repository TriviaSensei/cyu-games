/**
 * Client side timer manager - displays an (Approximation) of the time left on the clock.
 * This still relies on the server side keeping the actual time left, which should be sent with the game state
 * each time it is updated.
 * The game state should have an array of player objects ('players'), each of which has the following attributes (among others)
 * - A user object (with an ID)
 * - some attribute with the value of the time left
 */

export class TimerManager {
	getTimeString(time) {
		const sec = Math.floor((time % 60000) / 1000);
		const min = Math.floor(time / 60000);
		return `${min}:${sec < 10 ? '0' : ''}${sec}`;
	}

	updateState(state) {
		if (!state) return;
		const turn = this.getTurn(state);
		this.timers.forEach((t) => {
			let playerIndex;
			const player = state.players.find((p, i) => {
				if (!p.user) return false;
				if (p.user.id === t.id) {
					playerIndex = i;
					return true;
				}
			});
			if (!player) return;

			//put the correct value on the timer(s)
			const timeLeft = this.getTimerValue(player);

			const timeStr = this.getTimeString(timeLeft.time);
			t.timer.innerHTML = timeStr;
			const reserveStr = this.getTimeString(timeLeft.reserve);
			t.reserve.innerHTML = reserveStr;

			//if it's not this player's turn, stop running their clock
			if (playerIndex !== turn) {
				if (t.interval) clearInterval(t.interval);
				t.interval = null;
				t.startTime = null;
				t.initialValue = null;
			} else {
				//start this player's clock
				t.startTime = Date.now();
				t.initialValue = timeLeft;
				// (if it's not already started)
				if (!t.interval)
					t.interval = setInterval(() => {
						const timeElapsed = Date.now() - t.startTime;
						const timeLeft = Math.max(t.initialValue.time - timeElapsed, 0);
						t.timer.innerHTML = this.getTimeString(timeLeft);
						if (t.setting === 'move') {
							const reserveLeft =
								timeLeft > 0
									? t.initialValue.reserve
									: Math.max(
											0,
											t.initialValue.reserve - timeElapsed + t.initialValue.time
									  );
							t.reserve.innerHTML = this.getTimeString(reserveLeft);
						}
					}, 1000);
			}
		});
	}

	/**
	 *
	 * @param mapper
	 *      a function that takes in a player from gameState.players and returns the element of the timer associated with them
	 * @param getTurn
	 *      a function that takes a gameState, and returns the index of the player whose turn it is
	 * @param getTimerValue
	 *      a function that takes a player from gameState.players and amount of time elapsed, and returns the number of milliseconds on their timer (e.g. whether
	 *      we should use player.timeLeft, player.reserve, etc.)
	 */
	constructor(mapper, getTurn, getTimerValue, initialState) {
		this.mapper = mapper;
		this.getTurn = getTurn;
		this.getTimerValue = getTimerValue;
		this.timers = initialState.players.map((p) => {
			return {
				id: p.user.id,
				timer: this.mapper(p).querySelector('.player-timer'),
				reserve: this.mapper(p).querySelector('.player-reserve'),
				setting: p.timer,
				interval: null,
				startTime: null,
				initialValue: {
					time: p.time,
					reserve: p.reserve,
				},
			};
		});
		this.updateState(initialState);
	}
}

import { GameController } from './gameController.js';
import { UIController } from './uiController.js';

const game = new GameController(() => {});
const ui = new UIController(game);
game.onChange = (view) => ui.render(view);
game.onGameEnd = (view) => ui.showResult(view);
ui.render(game.getView());

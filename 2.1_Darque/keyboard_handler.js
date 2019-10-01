/**
 * keyboard_handler.js
 *
 * bla bla bla
 */
 

// Add a keyboard listener on keyup / keydown to track Shift state.
if (window == top) {
  window.addEventListener('keydown', keyListener, false);
  window.addEventListener('keyup', keyListener, false);
}

/**
* Keyboard keydown / keyup listener callback.
*/
function keyListener(e) {
  chrome.extension.sendRequest({type: 'shiftKey', shiftKey: e.shiftKey});
}
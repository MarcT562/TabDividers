
var global = {toggledTabId: null};
var DELIMITER = '&&';

localStorage.nextColorIndex = 0;

chrome.browserAction.onClicked.addListener(function(tab) {
  getNextEnum(function(nextEnum) {

    if (isNaN(localStorage.nextDividerId))
    {
      localStorage.nextDividerId = 0;
    }

    var createProperties = {
      'index': tab.index,
      'url': 'grouptemplate.html#grouptitle=Divider%20' + nextEnum +
          '&&newgroup=true&&colorindex=' + 
          localStorage.nextColorIndex +
          '&&id=' + localStorage.nextDividerId
    };

    localStorage.nextDividerId = parseInt(localStorage.nextDividerId) + 1;
    localStorage.nextColorIndex = (parseInt(localStorage.nextColorIndex) + 1) % 
        12;
    localStorage.nextEnum = parseInt(nextEnum) + 1;
  
    chrome.tabs.create(createProperties);  

    chrome.extension.sendRequest({type: 'updateBrowserAction'});
  });
});


chrome.commands.onCommand.addListener(function(command) {
  focusDividerTab();
});


function focusDividerTab() {
  // get current group
  chrome.tabs.getSelected(null, function(tab) {
    getContainingGroup(tab.id, function(idGroup) {
      if (idGroup) {
        var updateProperties = {selected: true};
  
        if (idGroup == tab.id) {
          // if on a group, toggle back to toggled tab (if thats how we got here)
          if (global.toggledTabId) {
            chrome.tabs.update(global.toggledTabId, updateProperties);
            global.toggledTabId = null;
          }
        } else {
          // toggle to the group tab
          chrome.tabs.update(idGroup, updateProperties);
          global.toggledTabId = tab.id;
        }
      }
    });
  });
}

// getNextEnum simply returns the next enum for tab title 'Divider n'
// it gets the value from local storage if there are any existing group tabs in 
// all of Chrome's windows
// otherwise it resets the value to 1

function getNextEnum(callback) {
  var nextEnum;
  var w, t, tab;
  var numGroups = 0;

  // create list itemes for groups
  var getInfo = {populate: true};

  chrome.windows.getAll(getInfo, function(windows) {
    nextEnum = localStorage.nextEnum ? localStorage.nextEnum : 1;
    
    for (w = 0; w < windows.length; w ++) {
      for (t = 0; t < windows[w].tabs.length; t++) {
        tab = windows[w].tabs[t];
        
        if (isGroupTab(tab)) {
          numGroups++;
        }
      }
    }
    
    nextEnum = numGroups ? localStorage.nextEnum : 1;
    
    callback(nextEnum);
  });
}

// any change to the tabs warrants an update of the groups
chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {
  // update the group associated with the attached tab
  updateGroupByTabId(tabId);
  
  // if the attached tab was itself a group, update the prior group too
  chrome.tabs.get(tabId, function(tab) {
      if (isGroupTab(tab)) {
        updateGroupByTabId(tabId, true);
      }	
    });  
});

chrome.tabs.onDetached.addListener(function(tabId, detachInfo) {
  // if the detached tab was in 0th position there can't be any groups to update
  if (detachInfo.oldPosition > 0) {
  	chrome.tabs.getAllInWindow(detachInfo.oldWindowId, function(tabs){
  		updateGroupByTabId(tabs[detachInfo.oldPosition - 1].id);
  	});
  }
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  // no need to update groups if the window is being closed
  if (!removeInfo.isWindowClosing) {
	// since we don't get oldWindowId here, need to update all groups (of the 
	// current (last active) window)	
  	chrome.tabs.getAllInWindow(null, function(tabs){
	  for(var i=0; i<tabs.length; i++) {
	    if (isGroupTab(tabs[i])) {
		  chrome.extension.sendRequest({type: 'updateThisGroup', tabId:tabs[i].id});
		}
	  }
  	});
  }
});

chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
  // first you know you must update the group of the tab at its new position...
  updateGroupByTabId(tabId);

  // now update any other affected group
  chrome.tabs.get(tabId, function(tab) {
  	chrome.tabs.getAllInWindow(tab.windowId, function(tabs) {
      if (moveInfo.fromIndex < moveInfo.toIndex) {
        // if the tab moved to a greater position, update the group of the old 
        // position...
  		  updateGroupByTabId(tabs[moveInfo.fromIndex].id);
  
        // AND update the group to the left of the new position if not position 
        // 0 and the dragged tab is a group
        // (NOTE: this may result in the group to the left being updated 
        // twice... not sure whether that is worth writing more code to avoid)
  		  if (isGroupTab(tab) && moveInfo.toIndex) {
     	    updateGroupByTabId(tabs[moveInfo.toIndex - 1].id);
    		}
  	  } else if (moveInfo.fromIndex < tabs.length - 1 ){
  	  	// if the tab moved to a lower position, update the group of [the old
  	  	// position + 1]
        updateGroupByTabId(tabs[moveInfo.fromIndex + 1].id);
  	  }
  	});  	
  });
});

chrome.tabs.onCreated.addListener(function(tab) {
  // update the group prior to the created tab
  updateGroupByTabId(tab.id, true);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (!isGroupTab(tab)) {
  	updateGroupByTabId(tabId);
  }
});

// when a tab is selected its ui should get redrawn (to update the groups list)
chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo) {
  // if the selected tab was itself a group, update the prior group too
  chrome.tabs.get(tabId, function(tab) {
      chrome.extension.sendRequest({type: 'updateUI'});
      chrome.extension.sendRequest({type: 'updateBrowserAction'});
    });
});

// when a tab is selected its ui should get redrawn (to update the groups list)
chrome.windows.onFocusChanged.addListener(function(windowId) {
  if (windowId != chrome.windows.WINDOW_ID_NONE) {

    // if the selected tab was itself a group, update the prior group too
    chrome.tabs.getSelected(windowId, function(tab) {
      if (isGroupTab(tab)) {
        chrome.extension.sendRequest({type: 'updateUI'});
      }      
    });
  }
});


function getContainingGroup(tabId, callback) {
	chrome.tabs.get(tabId, function(tab) {
    chrome.tabs.getAllInWindow(tab.windowId, function(tabs) {
      var groupId = null;
      var i;
      
      for (i=tab.index; i >= 0; i--) {
        if (isGroupTab(tabs[i])) {
          groupId = tabs[i].id;
          break;
        }
      }
      
      callback(groupId, tabs[i]);
    });
  });  
}

function updateGroupByTabId(tabId, usePriorTab) {
	chrome.tabs.get(tabId, function(tab) {
	  if (isGroupTab(tab) && !usePriorTab) {
        chrome.extension.sendRequest({type: 'updateThisGroup', tabId:tabId});
	  } else {
	  	chrome.tabs.getAllInWindow(tab.windowId, function(tabs) {
		  for (var i=tab.index - 1; i >= 0; i--) {
		    if (isGroupTab(tabs[i])) {
				chrome.extension.sendRequest({type: 'updateThisGroup', tabId:tabs[i].id});
			};
		  }
		})
	  }
	})
}



// UTILITY FUNCTIONS

function isGroupTab(tab) {
  // TODO: write a better check to see if this is a group tab
  return (tab.url.indexOf('grouptemplate.html') != -1);
}

function parseHash(hash) {
  var p = {};
  var re;

  // extract out just the hash if a full URL was passed in
  hash = hash.substring(hash.indexOf('#'));
    
  hash = decodeHash(hash);  // restore # symbols
  var parameters = hash.substring(1).split(DELIMITER);
  
  
  for (var i=0; i<parameters.length; i++) {
    
    var pair = [parameters[i].slice(0, parameters[i].indexOf('=')), 
                parameters[i].slice(parameters[i].indexOf('=') + 1,
                parameters[i].length)];
    
    // use regular expression to escape quotes (can appear in tab titles or 
    // group names)
    re = /"/g;
    pair[1] = pair[1].replace(re, '\\\"')

    switch (pair[0]) {
      case 'grouptitle':
        p.grouptitle = pair[1];
        break;
      case 'newgroup':
        p.newgroup = pair[1];
        break; 
      case 'expanded':
        p.expanded = pair[1];
        break;
      case 'numtabs':
        p.numtabs = pair[1];
        break;
      case 'colorindex':
        p.colorindex = pair[1];
        break;
    }
  }
  
  return p;
}

function decodeHash(hash) {
  re = /\$hash\$/g;
  return hash.replace(re, '#');  
}
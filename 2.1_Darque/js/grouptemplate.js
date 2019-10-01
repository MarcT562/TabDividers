var DELIMITER = '&&';
var params = {};
var bGroupTitleHasFocus = false;
var drag = {startX: 0, startY: 0, offsetX: 0, offsetY: 0, dragElement: null, 
    dragging: false, dragged: false};

document.body.onload = load;

function $(id){return document.getElementById(id);}

function load() { 
  $('coloricon').onclick = colorIconToggleExpanded;
  $('coloricon').onmousedown = eatMouseDown;
  $('dropbutton').onclick = dropButtonToggleColorPad;
  $('dropbutton').onmousedown = eatMouseDown;
  
  $('cb0').onclick = changeColorClosure(0);
  $('cb1').onclick = changeColorClosure(1);
  $('cb2').onclick = changeColorClosure(2);
  $('cb3').onclick = changeColorClosure(3);
  $('cb4').onclick = changeColorClosure(4);
  $('cb5').onclick = changeColorClosure(5);
  $('cb6').onclick = changeColorClosure(6);
  $('cb7').onclick = changeColorClosure(7);
  $('cb8').onclick = changeColorClosure(8);
  $('cb9').onclick = changeColorClosure(9);
  $('cb10').onclick = changeColorClosure(10);
  $('cb11').onclick = changeColorClosure(11);

  $('grouptitle').onclick = focusTitle;
  $('grouptitle').onchange = onTitleChange;
  $('grouptitle').onfocus = onTitleFocus;
  $('grouptitle').onblur = onTitleBlur;
      

  // parse hash into params object
  var locationParams = parseHash(location.hash);
  params = parseHash(location.hash);
  if (locationParams.newgroup)
  {
    params.numtabs = 0;
    params.expanded = "true";
    location.replace(location.origin + location.pathname + '#id=' + params.id);

    updateThisGroup();

    setTimeout(focusTitle, 150);

    finishInit();
  }
  else
  {
    var key = 'divider_' + params.id;
    chrome.storage.local.get(key, function(result)
    {
      params = parseHash(result[key]);
      params.id = locationParams.id;

      updateThisGroup();

      finishInit();
    });
  }
}

function finishInit() {
  // initialize for drag drop
  document.onmousedown = onMouseDown;
  document.onmouseup = onMouseUp;  

  document.onclick = onDocumentClick;
  
  updateUI(); // to fix issue of UI not updating on reload of a collapsed tab
}

function onTitleChange() {
  params.grouptitle = $('grouptitle').value;  
  $('grouptitle').blur();

  updateThisGroup();
}

function onTitleFocus() {
  bGroupTitleHasFocus = true;
}

function onTitleBlur() {
  bGroupTitleHasFocus = false;
}


function focusTitle() {
  $('grouptitle').focus();
  $('grouptitle').select();
}

chrome.extension.onRequest.addListener(
  function(request, sender, sendResponse) {
    switch(request.type) {
      case 'updateThisGroup':
        chrome.tabs.get(request.tabId, function(tab) {
          // only respond to this message if it applies to this group tab
          if (tab.url == location.href) {
            updateThisGroup();
			      sendResponse({});	// ensure request is finalized when match is found
          }
        });
        break;		

      case 'updateUI':
        updateUI();
			  sendResponse({});	// make sure request is finalized when match is found
        break;

      case 'updateBrowserAction':
        chrome.browserAction.setIcon({path : 'icons/e19_' +
            localStorage.nextColorIndex + '.png'});
        break;
    }
  });


// build the UI from the parameters
function updateUI() {
  var row;
  var img;
  var span;
  var group;
  var windowbox;
  var close;
  var index;

  var tabsList = $('tabs-list');
  removeChildren(tabsList);
  
  var windowsList = $('windows-list');

    // set title
  if (params.grouptitle) {
    document.title = decodeURI(params.grouptitle);
    
    if (!bGroupTitleHasFocus) {
      $('grouptitle').value = decodeURI(params.grouptitle);
    }
  }

  // set color
  if (params.expanded == 'true') {
    $('coloricon').src = 'icons/e36_' + params.colorindex + '.png';
    tabsList.classList.remove('collapsed');
  } else {
    $('coloricon').src = 'icons/c36_' + params.colorindex + '.png';
    tabsList.classList.add('collapsed');
  }
  
  updateFavIcon(params.colorindex);
  
  // create list items for tabs
  if (params.numtabs) {
    for (var i = 0; i < params.numtabs; i++) {
      row = document.createElement('div');
		  row.className = 'tabrow';

	  	img = document.createElement('img');
		  img.className = 'favicon';
		  img.src = decodeURI(params.tabfavicon[i]);
		  img.style.width = '16px';
		  img.style.height = '16px';
		  img.onmousedown = 'return false';
		  row.appendChild(img);
		
		  span = document.createElement('span');
// decodeURI FAILS IF THERE'S A % SIGN IN THE TITLE
// IT'S NOT CLEAR WHY I WAS RUNNING decodeURI IN THE FIRST PLACE
//      span.innerHTML = decodeURI(params.tabtitle[i]);
      span.innerHTML = params.tabtitle[i];
		  span.onmousedown = 'return false';
		  row.appendChild(span);
		
		  close = document.createElement('img');
		  close.className = 'close-x';
		  close.src = 'images/blank.png';
		  close.title = 'Close tab'
		  close.onclick = clickClose;
		  close.onmousedown = 'return false';
		  row.appendChild(close);

      row.onclick = clickTabRow;
      
      tabsList.appendChild(row);
    }
  }
  
  // create list itemes for groups
  var getInfo = {populate: true};
  
  chrome.windows.getAll(getInfo, function(windows) {
    chrome.tabs.getSelected(null, function(tab) {
      chrome.storage.local.get(null, function(result)
      {
        // keep count of the number of groups found... if it is 1 then remove 
        // the windows list
        var numGroups = 0;

        removeChildren(windowsList);

        for (var windex = 0; windex < windows.length; windex++) {
          var groups = [];
          var t;
        
          for (var tindex = 0; tindex < windows[windex].tabs.length; tindex++) {
            t = windows[windex].tabs[tindex];
          
            if (isGroupTab(t)) {
              var urlParams = parseHash(t.url);
              var key = 'divider_' + urlParams.id;
              if (!result[key] || result[key].length <= 0)
              {
                continue;
              }
              var p = parseHash(result[key]);
              
              group = document.createElement('div');
              group.className = 'grouprow';
              
              img = document.createElement('img');
              img.className = 'favicon';

              if (p.expanded == 'true') {
                img.src = 'icons/e16_' + p.colorindex + '.png';
              } else {
                img.src = 'icons/c16_' + p.colorindex + '.png';
              }
              group.appendChild(img);
              
              span = document.createElement('span');
              span.innerHTML = decodeURI(p.grouptitle);
              span.onmousedown = 'return false';
              group.appendChild(span);

              if (t == tab) {
                // if this is the current group
                group.classList.add('current');
              }
              
              // store the tab id in the row element for easy reference 
              // in clickGroupRow
              group.tabid = t.id;
              group.onclick = clickGroupRow;
              
              groups.push(group);
              numGroups++;
            }
          }
        
          if (groups.length) {
            windowbox = document.createElement('div');
            windowbox.className = 'windowbox';
            
            for (var gindex = 0; gindex < groups.length; gindex++) {
              windowbox.appendChild(groups[gindex]);
            }
            
            windowsList.appendChild(windowbox);
          }
        }
        
        if (numGroups == 1) {
          // if there is only one group there is no point in providing a 
          // group jump list
          removeChildren(windowsList);      
        }
      });
    });
  });
}


// updates the metadata representing the group of this page,
// calls updateUI afterward
function updateThisGroup() {
  if (params.expanded == 'true') {
    var i;
    var hash = '#';
  
    chrome.tabs.getAllInWindow(null, function(tabs) {
  	  // locate this tab in the tabs array
	    var thisTabIndex;
	    for (thisTabIndex = 0; thisTabIndex < tabs.length; thisTabIndex++) {
	      if (tabs[thisTabIndex].url == location.href) {
	  	    // we have found this tab
          console.log("Update Group Param ID : " + params.id);

          // same divider id as in hash already
          hash += 'id=' + params.id + DELIMITER;
          console.log("Id writting : " + params.id);
	  	    
	  	    // same group title as in hash already
          hash += 'grouptitle=' + params.grouptitle + DELIMITER;

          // same color index
          hash += 'colorindex=' + params.colorindex + DELIMITER;

          // we have already filtered for expandedness
          hash += 'expanded=' + 'true' + DELIMITER;
      
          var numtabs = 0;
          for (i = thisTabIndex + 1; i < tabs.length && !isGroupTab(tabs[i]); i++) {
            hash += 'tabtitle=' + tabs[i].title + DELIMITER;
            hash += 'taburl=' + tabs[i].url + DELIMITER;
            hash += 'tabfavicon=' + tabs[i].favIconUrl + DELIMITER;
            numtabs++;
          }

          hash += 'numtabs=' + numtabs;
          var key = 'divider_' + params.id;

          setHash(hash); // triggers updateUI

          // DARQUE: addition for non-url based storage.
          chrome.storage.local.set({ [key] : hash }, function() { updateUI(); });

          break;
	      }
	    }
    });
  }
}

function colorIconToggleExpanded() {
  if (params.expanded == 'true') {
    collapseGroup();
  } else {
    expandGroup();
  }
}

function dropButtonToggleColorPad() {
  if ($('colorpad').style.display == 'block') {
    $('colorpad').style.display = 'none';
  } else {
    // set the icons to either expanded or collapsed versions
    var state = params.expanded == 'true' ? 'e' : 'c';

    if (params.expanded) {
      $('cb0').src = 'icons/e36_0.png';
      $('cb1').src = 'icons/e36_1.png';
      $('cb2').src = 'icons/e36_2.png';
      $('cb3').src = 'icons/e36_3.png';
      $('cb4').src = 'icons/e36_4.png';
      $('cb5').src = 'icons/e36_5.png';
      $('cb6').src = 'icons/e36_6.png';
      $('cb7').src = 'icons/e36_7.png';
      $('cb8').src = 'icons/e36_8.png';
      $('cb9').src = 'icons/e36_9.png';
      $('cb10').src = 'icons/e36_10.png';
      $('cb11').src = 'icons/e36_11.png';
    } else {
      $('cb0').src = 'icons/c36_0.png';
      $('cb1').src = 'icons/c36_1.png';
      $('cb2').src = 'icons/c36_2.png';
      $('cb3').src = 'icons/c36_3.png';
      $('cb4').src = 'icons/c36_4.png';
      $('cb5').src = 'icons/c36_5.png';
      $('cb6').src = 'icons/c36_6.png';
      $('cb7').src = 'icons/c36_7.png';
      $('cb8').src = 'icons/c36_8.png';
      $('cb9').src = 'icons/c36_9.png';
      $('cb10').src = 'icons/c36_10.png';
      $('cb11').src = 'icons/c36_11.png';
    }
    
    $('colorpad').style.display = 'block';
  }
}


function eatMouseDown() {
  return false;
}

function collapseGroup() {
   // have to set expanded property BEFORE closing tabs so they will not be 
   // removed from the UI
   params.expanded = 'false';
   onSetGroupProperty();
   chrome.tabs.getAllInWindow(null, function(tabs) {
    chrome.tabs.getSelected(null, function(tab) {

      for(var i = tab.index + parseInt(params.numtabs); i > tab.index; i--) {
        chrome.tabs.remove(tabs[i].id);
      }
    });
  });
}

// NOTE: expanding a group creates several UI updates.  For each tab there will
// be an onCreated callback plus two onUpdated callbacks (loading and complete).  
// We can safely ignore the onCreated since the loading onUpdated will duplicate 
// it, however we can't ignore the other two since completion may take a while 
// and we don't want to block the UI forcing the user to wait until all tabs 
// have loaded before being able to use them.
function expandGroup() {
  var createProperties = {};

  chrome.tabs.getSelected(null, function(tab) {
    for(var i = 0; i < params.numtabs; i++) {
      createProperties.index = tab.index + 1 + i;
      createProperties.url = params.taburl[i];
      createProperties.selected = false;
      chrome.tabs.create (createProperties);
    }
  });

  params.expanded = 'true';
  onSetGroupProperty();
}

// given a property and value, swap those in the hash string
// then update of the UI
function onSetGroupProperty() {
  var newHash = makeHash();
  setHash(newHash); // triggers updateUI
}

// must encode hashes within tab urls since the browser encodes them as %23
// which breaks the URLs
function setHash(hash) {
  re = /\#/g;
  hash = '#' + hash.replace(re, '$hash$');
  
  // DARQUE: Moving to a local storage + id based system.
  // location.replace(location.origin + location.pathname + hash);
  
  // now that its set, parse it into params
  params = parseHash(hash);
  
  // and update the UI to reflect it
  updateUI();
}

function decodeHash(hash) {
  re = /\$hash\$/g;
  return hash.replace(re, '#');  
}

function updateFavIcon(colorindex) {
  var link = document.querySelector('link[rel~="icon"]');
  link.type = 'image/x-icon';

  if (params.expanded == 'true') {
    link.href = 'icons/e16_' + colorindex + '.png';
  } else {
    link.href = 'icons/c16_' + colorindex + '.png';
  }
}


// select a tab based on (1-based) offset from group tab (via click)
function selectNthTabOfGroup(n) {
	chrome.tabs.getSelected(null, function(tab) {
		chrome.tabs.getAllInWindow(null, function(tabs) {
			var updateProperties = {selected: true};			
			chrome.tabs.update(tabs[tab.index + n + 1].id, updateProperties);
		});
	});
}

function changeColorClosure(index) {
  return function() {
    changeColor(index);
  }
}

function changeColor(index) {
  params.colorindex = index;
  onSetGroupProperty();

  updateFavIcon(index);
  $('colorpad').style.display = 'none';
}



/////////////// MOUSE MOVE / DRAG FUNCTIONS
function onMouseDown(e) { 
  // if mouse down on close button let it go
  if (e.target.classList && e.target.classList.contains('close-x')) {
    return;
  }
  
  drag.dragged = false;
  drag.tabsList = $('tabs-list');
  if (drag.tabsList.firstChild) {
    drag.listOffset = getOffset(drag.tabsList);
    drag.lineHeight = drag.tabsList.firstChild.clientHeight;
  
    // check to see if mouse down was on a row
    var row = getRowOf(e.target);
    
    if (row) {
      // get mouse position
      drag.startX = e.clientX;
      drag.startY = e.clientY + document.body.scrollTop;
      
      // grab the clicked elements position
      drag.offsetX = extractNumber(row.style.left);
      drag.offsetY = extractNumber(row.style.top);
      
      // apply the dragging style (adds z index, removes transitions)
      row.classList.add('dragging');
      
      drag.dragElement = row;
    
      // get index of dragged element
      var index = 0;
      var sibling = row.previousSibling;
      while (sibling) {
        index++;
        sibling = sibling.previousSibling;
      }
      
      drag.dragFromIndex = index;
      
      document.onmousemove = onMouseMove;
    }
  }
}

function onMouseMove(e) {
  drag.listOffset = getOffset(drag.tabsList);

  // get dragToIndex based on current mouse position
  var dragToIndex;
 
  var dragListY = e.clientY - drag.listOffset.top;

  
  drag.dragOverIndex = Math.min(Math.max(Math.floor(dragListY /
      drag.lineHeight) , 0), drag.tabsList.children.length - 1);
  
  // shift items out of the way up or down based on drag position
  shiftRows();
  
  
  if (!drag.dragging && Math.abs(drag.offsetY + e.clientY - drag.startY) > 3) {
    drag.dragging = true;
  }
  
  if (drag.dragging) {
    drag.dragElement.style.top = (drag.offsetY + Math.min(drag.listOffset.top +
        drag.tabsList.clientHeight, Math.max(drag.listOffset.top + 12,
        e.clientY)) - drag.startY + document.body.scrollTop) + 'px';  
  }  
}

function shiftRows() {
  var dragFromIndex = drag.dragFromIndex;
  var dragOverIndex = drag.dragOverIndex;
  var curRow;

  for (var i = 0; i < drag.tabsList.children.length; i++) {
    curRow = drag.tabsList.children[i];

    if (dragOverIndex < dragFromIndex) {
      curRow.style.webkitTransform = 'none';

      if (i >= dragOverIndex && i < dragFromIndex) {
        curRow.style.webkitTransform = 'translate(0, 1.7em)';
      } else {
        curRow.style.webkitTransform = 'none';
      }

    } else if (dragOverIndex > dragFromIndex) {
      curRow.style.webkitTransform = 'none';

      if (i > dragFromIndex && i <= dragOverIndex) {
        curRow.style.webkitTransform = 'translate(0, -1.7em)';
      } else {
        curRow.style.webkitTransform = 'none';
      }

    } else {
      curRow.style.webkitTransform = 'none';
    }

  }
}


function onMouseUp(e) {
  if (drag.dragging) {
    drag.dragged = true;
  }
  
  drag.dragging = false;
  
//  if (drag.dragElement != null) {
  if (drag.dragged) {
    drag.dragElement.classList.remove('dragging');

    // if dropped at the same index just update the UI so the row snaps back
    // into place
    if (drag.dragFromIndex == drag.dragOverIndex) {
      updateUI();
    } else {
      if (params.expanded == 'true') {
        // swap the tabs if the group is expanded
        chrome.tabs.getAllInWindow(null, function(tabs) {
          chrome.tabs.getSelected(null, function(tab) {
            var moveProperties = {index: drag.dragOverIndex + tab.index + 1};
            chrome.tabs.move(tabs[drag.dragFromIndex + tab.index + 1].id,
                moveProperties);
          });
        });
      } else {
        // swap the hash values if the group is collapsed
        var fromTitle = params.tabtitle[drag.dragFromIndex];
        var fromUrl = params.taburl[drag.dragFromIndex];
        var fromFavicon = params.tabfavicon[drag.dragFromIndex];
        var overTitle = params.tabtitle[drag.dragOverIndex];
        var overUrl = params.taburl[drag.dragOverIndex];
        var overFavicon = params.tabfavicon[drag.dragOverIndex];
        
        params.tabtitle[drag.dragOverIndex] = fromTitle;
        params.taburl[drag.dragOverIndex] = fromUrl;
        params.tabfavicon[drag.dragOverIndex] = fromFavicon;
  
        params.tabtitle[drag.dragFromIndex] = overTitle;
        params.taburl[drag.dragFromIndex] = overUrl;
        params.tabfavicon[drag.dragFromIndex] = overFavicon;
        
        // now process the revised params, set the hash, and update the UI
        var newHash = makeHash();
        setHash(newHash); // triggers updateUI
      }
    }
  }

  document.onmousemove = null;
  drag.dragElement = null;
}


/////////////// OTHER HANDLERS
function onDocumentClick(e) {
  if (e.target.id != 'dropbutton') {
    $('colorpad').style.display = 'none';
  }
}

function clickClose(e) {
  chrome.tabs.getSelected(null, function(tab) {
    var index = 0;
    var sibling = e.target.parentNode.previousSibling;

    while (sibling) {
      index++;
      sibling = sibling.previousSibling;
    }
    
    chrome.tabs.getAllInWindow(null, function(tabs) {
      if (params.expanded == 'true') {
        // remove the tab at index + index of group (add 1 for the group tab
        // itself)
        chrome.tabs.remove(tabs[index + tab.index + 1].id);
      } else {
        // remove the row, reset the query      
        removeTabFromCollapsedGroup(index);
      }    
    });      
  });

	e.stopPropagation();
}

function clickTabRow(e) {
  // dont process the click event if it was actually a drag action
  if (drag.dragged) {
    return;
  }
  
  var index = 0;
	var sibling = e.target.classList.contains('tabrow') ? 
	   e.target.previousSibling : e.target.parentNode.previousSibling;

  while (sibling) {
	  index++;
		sibling = sibling.previousSibling;
  }

	if (params.expanded == 'true') {
    selectNthTabOfGroup(index);				
  } else {
    // open that tab to the right of the collapsed group then remove it from 
    // the group (punt it out)
    var createProperties = {};
    
    chrome.tabs.getSelected(null, function(tab) {
      createProperties.index = tab.index + 1;
      createProperties.url = params.taburl[index];
      createProperties.selected = true;
      chrome.tabs.create (createProperties);

      removeTabFromCollapsedGroup(index);
    });
  }
}

function clickGroupRow(e) {
  var grouprow = e.target;
  
  while (!grouprow.classList.contains('grouprow')) {
    grouprow = grouprow.parentNode;
  }
  
  var updateProperties = {selected: true};
  chrome.tabs.update(grouprow.tabid, updateProperties);
}

/////////////// UTILITY FUNCTIONS

function parseHash(hash) {
  var p = {};
  p.tabtitle = [];
  p.taburl = [];
  p.tabfavicon = [];
  var re;

  // extract out just the hash if a full URL was passed in
  if (hash.indexOf('#') >= 0)
  {
    hash = hash.substring(hash.indexOf('#'));
  }
    
  hash = decodeHash(hash);  // restore # symbols
  var parameters = hash.substring(1).split(DELIMITER);
  
  var curTabIndex = -1;
  
  for (var i=0; i<parameters.length; i++) {
    
    var pair = [parameters[i].slice(0, parameters[i].indexOf('=')), 
        parameters[i].slice(parameters[i].indexOf('=') + 1, 
        parameters[i].length)];
    
    // use regular expression to escape quotes (can appear in tab titles or 
    // group names)
    re = /"/g;
    pair[1] = pair[1].replace(re, '\\\"')

    switch (pair[0]) {
      case 'id':
        p.id = pair[1];
        break;
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
      case 'tabtitle':
        curTabIndex++;
        p.tabtitle[curTabIndex] = pair[1];
        break;
      case 'taburl':
        p.taburl[curTabIndex] = pair[1];
        break;
      case 'tabfavicon':
        p.tabfavicon[curTabIndex] = pair[1];
        break;
    }
  }
    
  return p;
}


function makeHash() {
  var hash = '#';
  hash += 'id=' + params.id + DELIMITER;
  hash += 'grouptitle=' + params.grouptitle + DELIMITER;
  hash += 'colorindex=' + params.colorindex + DELIMITER;
  hash += 'expanded=' + params.expanded + DELIMITER;
  hash += 'numtabs=' + params.numtabs;
  
  if (params.numtabs > 0) {
    hash += DELIMITER;
  }
  
  for(var i=0; i<params.numtabs; i++) {
    hash += 'tabtitle=' + params.tabtitle[i] + DELIMITER;
    hash += 'taburl=' + params.taburl[i] + DELIMITER;
    hash += 'tabfavicon=' + params.tabfavicon[i];
    if (i < params.numtabs-1) {
      hash += DELIMITER;
    }
  }
  
  return hash;
}

function isGroupTab(tab) {
  // TODO: better check to see if this is a group tab
  return (tab.url.indexOf('grouptemplate.html') != -1);
}

function removeChildren(el) {
  if (el.hasChildNodes()) {
    while (el.childNodes.length>= 1) {
      el.removeChild(el.firstChild);
    }
  }
}

function removeTabFromCollapsedGroup(index) {
  params.tabtitle.splice(i,1);
  params.taburl.splice(i,1);
  params.tabfavicon.splice(i,1);
      
  params.numtabs--;
  
  // reset the group to expanded if empty
  if (params.numtabs == 0) {
    params.expanded = 'true';
  }
  
  var newHash = makeHash();
  setHash(newHash); // triggers updateUI
}

function getRowOf(el) {
  // get containing row of the element
  var row = el;
  
  while (row && (row.classList == undefined || 
      !row.classList.contains('tabrow'))) {
    row = row.parentNode;
  }
    
  return row;
}


function extractNumber(value)
{
  var n = parseInt(value);	
  return n == null || isNaN(n) ? 0 : n;
}


function getOffset(el) {
    var _x = 0;
    var _y = 0;
    while( el && !isNaN( el.offsetLeft ) && !isNaN( el.offsetTop ) ) {
        _x += el.offsetLeft - el.scrollLeft;
        _y += el.offsetTop - el.scrollTop;
        el = el.offsetParent;
    }
    return { top: _y, left: _x };
}


/* Copyright (C) 2014-2017 InBasic
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Home: http://add0n.com/bookmarks-manager.html
 * GitHub: https://github.com/inbasic/bookmarks-manager/
*/

/* globals $, utils, notify */
'use strict';

function getRoot() {
  if (localStorage.getItem('root')) {
    return localStorage.getItem('root');
  }
  return typeof InstallTrigger !== 'undefined' ? 'root________' : '0';
}

var tree = $('#tree');
tree.jstree({
  'types': {
    'file': {
      'icon': 'item',
      'max_children': 0
    },
    'folder': {
      'icon': 'folder'
    }
  },
  'plugins' : [
    'state',
    'dnd',
    'types',
    'contextmenu'
  ],
  'core' : {
    // Content Security Policy: The page’s settings blocked the loading of a resource at blob:moz-extension://
    'worker': !/Firefox/.test(navigator.userAgent),
    'check_callback' : true,
    'multiple': false,
    'data' : function(obj, cb) {
      chrome.bookmarks.getChildren(obj.id === '#' ? getRoot() : obj.id, nodes => {
        cb.call(this, nodes.map(node => {
          const children = !node.url;
          return {
            text: node.title,
            id: node.id,
            type: children ? 'folder' : 'file',
            icon: children ? null : utils.favicon(node.url),
            children,
            data: {
              dateGroupModified: node.dateGroupModified,
              dateAdded: node.dateAdded,
              url: node.url || ''
            }
          };
        }));
      });
    }
  },
  'contextmenu': {
    'items': node => ({
      'Copy Title': {
        'label': 'Copy Title',
        'action': () => utils.copy(node.text)
      },
      'Copy Link': {
        'label': 'Copy Link',
        'action': () => utils.copy(node.data.url),
        '_disabled': () => !node.data.url
      },
      'Rename Title': {
        'separator_before': true,
        'label': 'Rename Title',
        'action': () => window.dispatchEvent(new Event('properties:select-title'))
      },
      'Edit Link': {
        'label': 'Edit Link',
        'action': () => window.dispatchEvent(new Event('properties:select-link')),
        '_disabled': () => !node.data.url
      },
      'Set as Root': {
        'label': 'Set as Root',
        'action': () => {
          const ids = tree.jstree('get_selected');

          if (ids.length === 1) {
            localStorage.setItem('root', ids[0]);
            location.reload();
          }
          else {
            notify.inline('Please select a single directory');
          }
        },
        '_disabled': () => node.data.url
      },
    })
  }
});

tree.on('dblclick.jstree', () => {
  const ids = tree.jstree('get_selected');
  const node = tree.jstree('get_node', ids[0]);
  if (node && node.data && node.data.url) {
    const url = node.data.url;
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, tabs => {
      // if current tab is new tab, update it
      if (tabs.length && tabs[0].url === 'chrome://newtab/' || tabs[0].url === 'about:newtab') {
        chrome.tabs.update({url});
      }
      else {
        chrome.tabs.create({url});
      }
      window.close();
    });
  }
});

tree.on('move_node.jstree', (e, data) => {
  chrome.bookmarks.move(data.node.id, {
    parentId: data.parent,
    index: data.position + (data.old_position >= data.position ? 0 : 1)
  });
});

window.addEventListener('tree:open-array', e => {
  const arr = e.detail.nodes;
  tree.jstree('deselect_all');
  tree.jstree('close_all');
  tree.jstree('close_all', () => {
    tree.jstree('load_node', arr.reverse(), () => {
      const id = arr[0];
      tree.jstree('select_node', id);
      $('#' + id + '_anchor').focus();
    });
  });
});

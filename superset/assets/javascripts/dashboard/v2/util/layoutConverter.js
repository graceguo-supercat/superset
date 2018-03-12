const generateId = function() {
  let componentId = 1;
  return () => (componentId++);
}();

/**
 *
 * @param layout: single array of slices
 * @returns boundary object {top: number, bottom: number, left: number, right: number}
 */
function getBoundary(layout) {
  let top = Number.MAX_VALUE, bottom = 0,
    left = Number.MAX_VALUE, right = 1;
  layout.forEach(item => {
    const { row, col, size_x, size_y } = item;
    if (row <= top) top = row;
    if (col <= left ) left = col;
    if (bottom <= row + size_y) bottom = row + size_y;
    if (right <= col + size_x) right = col + size_x;
  });

  return {
    top,
    bottom,
    left,
    right
  };
}

function getRowContainer() {
  const id = 'DASHBOARD_ROW_TYPE-' + generateId();
  return {
    version: 'v2',
    type: 'DASHBOARD_ROW_TYPE',
    id,
    children: [],
    meta: {
      rowStyle: 'ROW_TRANSPARENT'
    },
  };
}

function getColContainer() {
  const id = 'DASHBOARD_COLUMN_TYPE-' + generateId();
  return {
    version: 'v2',
    type: 'DASHBOARD_COLUMN_TYPE',
    id,
    children: [],
    meta: {},
  };
}

function getChartHolder(item) {
  const { row, col, size_x, size_y, slice_id } = item;
  return {
    version: 'v2',
    type: 'DASHBOARD_CHART_TYPE',
    id: 'DASHBOARD_CHART_TYPE-' + generateId(),
    children: [],
    meta: {
      width: Math.max(1, Math.floor(size_x / 4.0)),
      height: size_y * 2,
      sliceId: 'slice_' + slice_id,
      row,
      col,
    },
  };
}

function sortByRowId(item1, item2) {
  return item1.row - item2.row;
}

function sortByColId(item1, item2) {
  return item1.col - item2.col;
}

function hasOverlap(layout, xAxis = true) {
  return layout.slice()
    .sort(!!xAxis ? sortByColId : sortByRowId)
    .some((item, index, arr) => {
      if (index === arr.length - 1) {
        return false;
      }

      if (!!xAxis) {
        return (item.col + item.size_x) > arr[index + 1].col;
      } else {
        return (item.row + item.size_y) > arr[index + 1].row;
      }
    });
}

function doConvert(layout, level, parent, root) {
  if (layout.length === 0) {
    return;
  }

  if (layout.length === 1) {
    // parent.push(layout[0].slice_id);
    const chartHolder = getChartHolder(layout[0]);
    root[chartHolder.id] = chartHolder;
    parent.children.push(chartHolder.id);
    return;
  }

  let currentItems = layout.slice();
  const { top, bottom, left, right } = getBoundary(layout);
  // find row dividers
  const layers = [];
  let currentRow = top + 1;
  while (currentItems.length && currentRow <= bottom) {
    const upper = [],
      lower = [];

    const isRowDivider = currentItems.every(item => {
      const { row, col, size_x, size_y } = item;
      if (row + size_y <= currentRow) {
        lower.push(item);
        return true;
      } else if (row >= currentRow) {
        upper.push(item);
        return true;
      } else {
        return false;
      }
    });

    if (isRowDivider) {
      currentItems = upper.slice();
      layers.push(lower);
    }
    currentRow++;
  }

  layers.forEach((layer) => {
    // create a new row
    const rowContainer = getRowContainer();
    root[rowContainer.id] = rowContainer;
    parent.children.push(rowContainer.id);

    currentItems = layer.slice();
    if (level >= 2 || !hasOverlap(currentItems)) {
      currentItems.sort(sortByColId).forEach(item => {
        const chartHolder = getChartHolder(item);
        root[chartHolder.id] = chartHolder;
        rowContainer.children.push(chartHolder.id);
      });
    } else {
      // find col dividers for each layer
      let currentCol = left + 1;
      while (currentItems.length && currentCol <= right) {
        const upper = [],
          lower = [];

        const isColDivider = currentItems.every(item => {
          const { row, col, size_x, size_y } = item;
          if (col + size_x <= currentCol) {
            lower.push(item);
            return true;
          } else if (col >= currentCol) {
            upper.push(item);
            return true;
          } else {
            return false;
          }
        });

        if (isColDivider) {
          // create a new column
          const colContainer = getColContainer();
          root[colContainer.id] = colContainer;
          rowContainer.children.push(colContainer.id);

          if (!hasOverlap(lower, false)) {
            lower.sort(sortByRowId).forEach(item => {
              const chartHolder = getChartHolder(item);
              root[chartHolder.id] = chartHolder;
              colContainer.children.push(chartHolder.id);
            });
          } else {
            doConvert(lower, level+2, colContainer, root);
          }

          // add col meta
          colContainer.meta.width = Math.max.apply(null, colContainer.children.map(child => {
            return root[child].meta.width;
          }));

          currentItems = upper.slice();
        }
        currentCol++;
      }
    }

    rowContainer.meta.width = rowContainer.children.reduce((preValue, child) => {
      return preValue + root[child].meta.width;
    }, 0);
  });
}

const dash1 = [
  {
    "col": 1,
    "row": 44,
    "size_x": 16,
    "size_y": 16,
    "slice_id": "240"
  }
];
const dash3 = [
  {
    "slice_id": "117",
    "size_x": 16,
    "size_y": 16,
    "v": 1,
    "col": 17,
    "row": 0
  },
  {
    "slice_id": "118",
    "size_x": 16,
    "size_y": 16,
    "v": 1,
    "col": 1,
    "row": 0
  },
  {
    "slice_id": "119",
    "size_x": 16,
    "size_y": 16,
    "v": 1,
    "col": 33,
    "row": 0
  }
];
const dash4 = [
  {
    "col": 1,
    "row": 12,
    "size_x": 48,
    "size_y": 12,
    "slice_id": "38"
  },
  {
    "col": 1,
    "row": 0,
    "size_x": 16,
    "size_y": 12,
    "slice_id": "42"
  },
  {
    "col": 17,
    "row": 0,
    "size_x": 32,
    "size_y": 12,
    "slice_id": "98"
  }
];
const dash5 = [
  {
    "col": 14,
    "row": 0,
    "size_x": 28,
    "size_y": 22,
    "slice_id": "38"
  },
  {
    "col": 1,
    "row": 0,
    "size_x": 13,
    "size_y": 8,
    "slice_id": "42"
  },
  {
    "col": 1,
    "row": 8,
    "size_x": 13,
    "size_y": 14,
    "slice_id": "98"
  }
];
const dash6= [
  {
    "col": 1,
    "row": 8,
    "size_x": 16,
    "size_y": 9,
    "slice_id": "45"
  },
  {
    "col": 17,
    "row": 0,
    "size_x": 16,
    "size_y": 17,
    "slice_id": "51"
  },
  {
    "col": 33,
    "row": 0,
    "size_x": 16,
    "size_y": 17,
    "slice_id": "57"
  },
  {
    "col": 1,
    "row": 4,
    "size_x": 16,
    "size_y": 4,
    "slice_id": "293"
  },
  {
    "col": 1,
    "row": 0,
    "size_x": 16,
    "size_y": 4,
    "slice_id": "294"
  }
];
const dash_annotation = [
  {
    "col": 22,
    "row": 12,
    "size_x": 11,
    "size_y": 11,
    "slice_id": "212"
  },
  {
    "col": 1,
    "row": 0,
    "size_x": 32,
    "size_y": 12,
    "slice_id": "213"
  },
  {
    "col": 1,
    "row": 12,
    "size_x": 10,
    "size_y": 11,
    "slice_id": "214"
  },
  {
    "col": 11,
    "row": 12,
    "size_x": 11,
    "size_y": 11,
    "slice_id": "215"
  },
  {
    "col": 33,
    "row": 14,
    "size_x": 16,
    "size_y": 9,
    "slice_id": "282"
  },
  {
    "col": 33,
    "row": 0,
    "size_x": 16,
    "size_y": 14,
    "slice_id": "283"
  }
];
const dash_wd_bank = [
  {
    "col": 1,
    "row": 0,
    "size_x": 8,
    "size_y": 8,
    "slice_id": "175"
  },
  {
    "col": 1,
    "row": 8,
    "size_x": 8,
    "size_y": 8,
    "slice_id": "176"
  },
  {
    "col": 37,
    "row": 0,
    "size_x": 12,
    "size_y": 28,
    "slice_id": "177"
  },
  {
    "col": 1,
    "row": 16,
    "size_x": 24,
    "size_y": 12,
    "slice_id": "178"
  },
  {
    "col": 9,
    "row": 0,
    "size_x": 28,
    "size_y": 16,
    "slice_id": "179"
  },
  {
    "col": 17,
    "row": 28,
    "size_x": 32,
    "size_y": 16,
    "slice_id": "180"
  },
  {
    "col": 25,
    "row": 16,
    "size_x": 12,
    "size_y": 12,
    "slice_id": "181"
  },
  {
    "col": 1,
    "row": 28,
    "size_x": 16,
    "size_y": 16,
    "slice_id": "182"
  },
  {
    "col": 33,
    "row": 44,
    "size_x": 16,
    "size_y": 16,
    "slice_id": "183"
  },
  {
    "col": 1,
    "row": 44,
    "size_x": 32,
    "size_y": 16,
    "slice_id": "184"
  }
];
const dash_birth = [
  {
    "col": 33,
    "row": 24,
    "size_x": 8,
    "size_y": 16,
    "slice_id": "186"
  },
  {
    "col": 41,
    "row": 24,
    "size_x": 8,
    "size_y": 16,
    "slice_id": "187"
  },
  {
    "col": 1,
    "row": 0,
    "size_x": 8,
    "size_y": 8,
    "slice_id": "188"
  },
  {
    "col": 9,
    "row": 0,
    "size_x": 8,
    "size_y": 8,
    "slice_id": "189"
  },
  {
    "col": 17,
    "row": 12,
    "size_x": 32,
    "size_y": 12,
    "slice_id": "190"
  },
  {
    "col": 1,
    "row": 24,
    "size_x": 32,
    "size_y": 16,
    "slice_id": "191"
  },
  {
    "col": 37,
    "row": 0,
    "size_x": 12,
    "size_y": 12,
    "slice_id": "192"
  },
  {
    "col": 17,
    "row": 0,
    "size_x": 20,
    "size_y": 12,
    "slice_id": "193"
  },
  {
    "col": 1,
    "row": 8,
    "size_x": 16,
    "size_y": 16,
    "slice_id": "194"
  },
  {
    "col": 1,
    "row": 40,
    "size_x": 32,
    "size_y": 16,
    "slice_id": "195"
  }
];
const dash_misc = [
  {
    "col": 1,
    "row": 28,
    "size_x": 24,
    "size_y": 16,
    "slice_id": "172"
  },
  {
    "col": 1,
    "row": 8,
    "size_x": 24,
    "size_y": 20,
    "slice_id": "173"
  },
  {
    "col": 25,
    "row": 8,
    "size_x": 24,
    "size_y": 16,
    "slice_id": "174"
  },
  {
    "col": 33,
    "row": 0,
    "size_x": 16,
    "size_y": 8,
    "slice_id": "185"
  },
  {
    "col": 25,
    "row": 24,
    "size_x": 24,
    "size_y": 20,
    "slice_id": "198"
  },
  {
    "col": 1,
    "row": 0,
    "size_x": 32,
    "size_y": 8,
    "slice_id": "199"
  },
  {
    "col": 1,
    "row": 44,
    "size_x": 24,
    "size_y": 16,
    "slice_id": "207"
  }
];

function convert() {
  const result = {};
  const root = {
    version: 'v2',
    type: 'DASHBOARD_GRID_ROOT_TYPE',
    id: 'DASHBOARD_ROOT_ID',
    children: [],
  };
  result['DASHBOARD_ROOT_ID'] = root;
  doConvert(dash6, 0, root, result);

  console.log(JSON.stringify(result));
}

convert();
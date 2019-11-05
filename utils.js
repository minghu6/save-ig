const SortedArray = require("sorted-array");

class CustomizedSet {
    constructor(fromArray, getKey = null) {
        this._constructor(getKey);
        const that = this;

        fromArray.map(e => {
            that.add(e);
        })
    }

    _constructor(getKey = null) {
        if (getKey != null) {
            this._getKey = getKey
        } else {
            this._getKey = x => x;
        }

        const compareFunc = (x1, x2) => {
            const key1 = this._getKey(x1);
            const key2 = this._getKey(x2);

            if (key1 < key2) {
                return -1;
            } else if (key1 == key2) {
                return 0;
            } else {
                return 1;
            }
        }
        this._objArray = new SortedArray([], compareFunc);
    }

    add(item) {
        const itemKey = this._getKey(item);
        const that = this;
        if (this._objArray.array.filter(e => that._getKey(e) == itemKey).length == 0) {
            this._objArray.insert(item);
        }
    }

    toSortedArray() {
        return this._objArray.array;
    }
    // ...
}

exports.CustomizedSet = CustomizedSet;
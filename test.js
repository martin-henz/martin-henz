let mem = [];

function read(n, k, l) {
    return mem[n] === undefined
           ? undefined
           : mem[n][k] === undefined
           ? undefined
           : mem[n][k][l];
}

function write(n, k, l, value) {
    if (mem[n] === undefined) {
        mem[n] = [];
    }
    
    if(mem[n][k] === undefined) {
        mem[n][k] = [];
    }

    mem[n][k][l] = value;
}

function bee_walk(n) {
    function get_bee_walks(i, j, m) {
        if(m === 0) {
            return i === 28 && j === 28
                    ? 1
                    : 0;
        } else {
            if(read(i, j, m) !== undefined) {
                return read(i, j, m);
            } else {
                const result = get_bee_walks(i - 1, j - 1, m - 1) +
                               get_bee_walks(i, j - 2, m - 1) +
                               get_bee_walks(i + 1, j - 1, m - 1) +
                               get_bee_walks(i - 1, j + 1, m - 1) +
                               get_bee_walks(i, j + 2, m - 1) +
                               get_bee_walks(i + 1, j + 1, m - 1);
                write(i, j, m, result);
                return result;
            }
        }
    }
    
    return get_bee_walks(28, 28, n);
}

bee_walk(4);
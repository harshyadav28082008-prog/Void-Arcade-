// VOID ARCADE - Common Storage System

const VoidStorage = {
    prefix: "void_arcade_",

    save(gameId, key, value) {
        const storageKey = this.prefix + gameId + "_" + key;

        try {
            localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (error) {
            console.error("VOID ARCADE: Could not save data.", error);
        }
    },

    load(gameId, key, defaultValue = null) {
        const storageKey = this.prefix + gameId + "_" + key;

        try {
            const data = localStorage.getItem(storageKey);

            if (data === null) {
                return defaultValue;
            }

            return JSON.parse(data);
        } catch (error) {
            console.error("VOID ARCADE: Could not load data.", error);
            return defaultValue;
        }
    },

    remove(gameId, key) {
        const storageKey = this.prefix + gameId + "_" + key;

        localStorage.removeItem(storageKey);
    },

    clearGame(gameId) {
        const prefix = this.prefix + gameId;

        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);

            if (key && key.startsWith(prefix)) {
                localStorage.removeItem(key);
            }
        }
    }
};
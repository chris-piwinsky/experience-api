"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryJourneysStore = void 0;
class InMemoryJourneysStore {
    journeys = new Map();
    create(journey) {
        this.journeys.set(journey.id, journey);
        return journey;
    }
    getById(id) {
        return this.journeys.get(id);
    }
    update(journey) {
        this.journeys.set(journey.id, journey);
        return journey;
    }
    clear() {
        this.journeys.clear();
    }
}
exports.InMemoryJourneysStore = InMemoryJourneysStore;

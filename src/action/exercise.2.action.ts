import Data from './exercises.json'

export function getExercises() {
    return Data
}

export function getExercise(id: string) {
    return Data.find((e) => e.id === id)
}
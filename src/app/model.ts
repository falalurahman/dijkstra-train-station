export class StationDetails {
    name!: string;
    distance!: number;

    constructor (name: string, distance: number) {
        this.name = name;
        this.distance = distance;
    }
}
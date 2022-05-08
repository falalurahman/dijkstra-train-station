import { Component, OnInit } from '@angular/core';
import { StationDetails } from './model'
import {
  Firestore,
  collection, 
  getDocs,
  onSnapshot,
  query,
  orderBy
} from '@angular/fire/firestore';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Dijkstra Aiports';

  stations: StationDetails[] = []

  constructor( private store: Firestore ) { }

  ngOnInit(): void {
    const stationsRef = collection(this.store, "stations");
    onSnapshot(query(stationsRef, orderBy('distance')), (docSnap) => {
      this.stations = [];
      docSnap.forEach( doc => {
        const name = doc.data()['name'];
        const distance = doc.data()['distance'];
        this.stations.push(new StationDetails(name, distance))
      });
    })
  }

}

import * as functions from "firebase-functions";
import {Request, Response} from "express";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const updateStartStation = functions.https.onRequest(
    (request: Request, response: Response) => {
      const queryText = request.query.startStation;
      const startStation: string | undefined = queryText?.toString();
      if (startStation != undefined) {
        setStartStation(startStation);
        db.collection("stations").get().then(
            (docSnap: any) => {
              docSnap.forEach((doc: any) => {
                const name: string = doc.data()["name"];
                // const distance = doc.data()['distance'];
                if (startStation != undefined) {
                  if (name.includes(startStation)) {
                    response.send("Starting Station: " + name);
                  }
                }
              });
            }
        ).catch(() => response.send("Undefined Station"));
      } else {
        response.send("Undefined Station");
      }
    });

const setStartStation = function(newStartStation: string): void {
  db.collection("startStation").doc("startStation")
      .set({value: newStartStation});
};

export const updateDistancesFromStartStation = functions.firestore
    .document("/startStation/startStation")
    .onWrite(
        (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
          const updatedValue = change.after.data()?.["value"];
          console.log("Updated Start Station to: " + updatedValue);
        });

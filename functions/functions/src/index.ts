import * as functions from "firebase-functions";
import {Request, Response} from "express";
import * as admin from "firebase-admin";
import {
  QuerySnapshot,
  DocumentData,
  WriteResult,
  QueryDocumentSnapshot,
} from "@google-cloud/firestore";

admin.initializeApp();
const db = admin.firestore();

export const updateStartStation = functions.https.onRequest(
    (request: Request, response: Response) => {
      const startStationQueryText = request.query.startStation;
      const startStation: string | undefined =
      startStationQueryText?.toString();
      const endStationQueryText = request.query.endStation;
      const endStation: string | undefined = endStationQueryText?.toString();
      if (startStation != undefined && endStation != undefined) {
        setStartStation(startStation, endStation, response);
      } else {
        response.send("Undefined Station");
      }
    });

const setStartStation = function(
    newStartStation: string,
    endStation: string,
    response: Response
): void {
  db.collection("startStation").doc("startStation")
      .set({value: newStartStation})
      .then(() => {
        return computeShortestParentFromSource(newStartStation);
      }).then((parentMap: Map<string, string>) => {
        return getShortestRouteFromSourceToDest(parentMap,
            endStation);
      }).then((shortestDistanceAirportsList: string[]) => {
        response.send(shortestDistanceAirportsList.join());
      });
};

const getShortestRouteFromSourceToDest = function(
    parentMap: Map<string, string>,
    destinationAirport: string
): string[] {
  const reverseRoute : string[] = [];
  let parentAirport = destinationAirport;
  reverseRoute.push(destinationAirport);
  while (parentAirport != "") {
    const currentParentAirport = parentAirport;
    const newParentAirport = parentMap.get(currentParentAirport);
    if (newParentAirport != undefined && newParentAirport !== "") {
      parentAirport = newParentAirport;
      reverseRoute.push(parentAirport);
    } else {
      parentAirport = "";
    }
  }
  return reverseRoute.reverse();
};

export const updateDistancesFromStartStation = functions.firestore
    .document("/startStation/startStation")
    .onWrite(
        (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
          const updatedValue = change.after.data()?.["value"];
          return updateShortestDistanceFromSourceInFirebase(updatedValue);
        });

const updateShortestDistanceFromSourceInFirebase = function(
    sourceAirport: string
): Promise<WriteResult[]> {
  return db.collection("edges").get().then(
      (edgesData: QuerySnapshot<DocumentData>) => {
        const graph = new Map<string, Map<string, number>>();
        const airportSet = new Set<string>();
        edgesData.forEach(
            (edgeDocument: QueryDocumentSnapshot<DocumentData>) => {
              const edge: DocumentData = edgeDocument.data();
              const fromAirport: string = edge["from"];
              const toAirport: string = edge["to"];
              const distanceBetweenAirport: number = edge["time"];

              if (!graph.has(fromAirport)) {
                graph.set(fromAirport, new Map<string, number>());
              }
              graph.get(fromAirport)?.set(toAirport, distanceBetweenAirport);
              console.log(fromAirport + " - " + toAirport +
              " : " + distanceBetweenAirport);
              airportSet.add(fromAirport);
              airportSet.add(toAirport);
            });
        const airportList = Array.from(airportSet.values());
        const distanceMap = runDijkstraAlgorithm(
            airportList, graph, sourceAirport);
        return updateDistanceInFirebase(distanceMap);
      });
};


const computeShortestParentFromSource = function(
    sourceAirport: string
): Promise<Map<string, string>> {
  return db.collection("edges").get().then(
      (edgesData: QuerySnapshot<DocumentData>) => {
        const graph = new Map<string, Map<string, number>>();
        const airportSet = new Set<string>();
        edgesData.forEach(
            (edgeDocument: QueryDocumentSnapshot<DocumentData>) => {
              const edge: DocumentData = edgeDocument.data();
              const fromAirport: string = edge["from"];
              const toAirport: string = edge["to"];
              const distanceBetweenAirport: number = edge["time"];

              if (!graph.has(fromAirport)) {
                graph.set(fromAirport, new Map<string, number>());
              }
              graph.get(fromAirport)?.set(toAirport, distanceBetweenAirport);
              airportSet.add(fromAirport);
              airportSet.add(toAirport);
            });
        const airportList = Array.from(airportSet.values());
        const parentMap = runDijkstraAlgorithmWithPath(
            airportList, graph, sourceAirport);
        return parentMap;
      });
};

const updateDistanceInFirebase = function(
    distanceMap: Map<string, number>
): Promise<WriteResult[]> {
  const writeBatch = db.batch();
  const airportsCollection = db.collection("stations");
  distanceMap.forEach((distance: number, airport: string) => {
    writeBatch.update(airportsCollection.doc(airport), {"distance": distance});
  });
  return writeBatch.commit();
};

const minDistance = function(
    dist: Map<string, number>,
    sptSet: Set<string>,
    airportList: string[]
): string {
  let minAirportDistance = Number.MAX_VALUE;
  let minAirport = "";

  for (let i = 0; i < airportList.length; i++) {
    const airport = airportList[i];
    const airportDistance = dist.get(airport) ?? Number.MAX_VALUE;
    const alreadyVisited = sptSet.has(airport) ?? false;
    if (!alreadyVisited && airportDistance <= minAirportDistance) {
      minAirportDistance = airportDistance;
      minAirport = airport;
    }
  }
  return minAirport;
};

const runDijkstraAlgorithm = function(
    airportList: string[],
    graph: Map<string, Map<string, number>>,
    sourceAirport: string,
    n: number | undefined = undefined
): Map<string, number> {
  const dist = new Map<string, number>();
  const sptSet = new Set<string>();

  for (let i = 0; i < airportList.length; i++) {
    const airport = airportList[i];
    dist.set(airport, Number.MAX_VALUE);
  }

  dist.set(sourceAirport, 0);

  for (let count = 0; count < (n ?? (airportList.length - 1)); count++) {
    const minDistanceAirport = minDistance(dist, sptSet, airportList);
    sptSet.add(minDistanceAirport);

    // Update dist value of the adjacent
    // vertices of the picked vertex.
    for (let v = 0; v < airportList.length; v++) {
      // Update dist[v] only if is not in
      // sptSet, there is an edge from u
      // to v, and total weight of path
      // from src to v through u is smaller
      // than current value of dist[v]
      const adjacentAirport = airportList[v];
      const alreadyVisited = sptSet.has(adjacentAirport);
      const edgeDistanceToAdjacentAirport =
      graph.get(minDistanceAirport)?.get(adjacentAirport) ?? undefined;
      const distanceToMinDistanceAirport = dist.get(minDistanceAirport) ?? 0;
      const oldDistanceToAdjacentAirport = dist.get(adjacentAirport) ?? 0;

      if (!alreadyVisited && edgeDistanceToAdjacentAirport != undefined) {
        const newDistanceToAdjacentAirport = distanceToMinDistanceAirport +
        edgeDistanceToAdjacentAirport;

        if ( distanceToMinDistanceAirport != Number.MAX_VALUE &&
          newDistanceToAdjacentAirport < oldDistanceToAdjacentAirport) {
          dist.set(adjacentAirport, newDistanceToAdjacentAirport);
        }
      }
    }
  }
  return dist;
};

const runDijkstraAlgorithmWithPath = function(
    airportList: string[],
    graph: Map<string, Map<string, number>>,
    sourceAirport: string
): Map<string, string> {
  const dist = new Map<string, number>();
  const parent = new Map<string, string>();
  const sptSet = new Set<string>();

  for (let i = 0; i < airportList.length; i++) {
    const airport = airportList[i];
    dist.set(airport, Number.MAX_VALUE);
  }

  dist.set(sourceAirport, 0);
  parent.set(sourceAirport, "");

  for (let count = 0; count < airportList.length - 1; count++) {
    const minDistanceAirport = minDistance(dist, sptSet, airportList);
    sptSet.add(minDistanceAirport);

    // Update dist value of the adjacent
    // vertices of the picked vertex.
    for (let v = 0; v < airportList.length; v++) {
      // Update dist[v] only if is not in
      // sptSet, there is an edge from u
      // to v, and total weight of path
      // from src to v through u is smaller
      // than current value of dist[v]
      const adjacentAirport = airportList[v];
      const alreadyVisited = sptSet.has(adjacentAirport);
      const edgeDistanceToAdjacentAirport =
      graph.get(minDistanceAirport)?.get(adjacentAirport) ?? undefined;
      const distanceToMinDistanceAirport = dist.get(minDistanceAirport) ?? 0;
      const oldDistanceToAdjacentAirport = dist.get(adjacentAirport) ?? 0;

      if (!alreadyVisited && edgeDistanceToAdjacentAirport != undefined) {
        const newDistanceToAdjacentAirport = distanceToMinDistanceAirport +
        edgeDistanceToAdjacentAirport;

        if ( distanceToMinDistanceAirport != Number.MAX_VALUE &&
          newDistanceToAdjacentAirport < oldDistanceToAdjacentAirport) {
          dist.set(adjacentAirport, newDistanceToAdjacentAirport);
          parent.set(adjacentAirport, minDistanceAirport);
        }
      }
    }
  }
  return parent;
};

import {test} from 'node:test';import assert from 'node:assert/strict';
import {validRoofOutline,surfaceArea,edgeLength} from '../lib/roof.ts';
const p=(lng,lat)=>({lng,lat});
test('valid convex and concave roof outlines are accepted',()=>{assert.equal(validRoofOutline([p(0,0),p(2,0),p(2,2),p(0,2)]),true);assert.equal(validRoofOutline([p(0,0),p(2,0),p(1,1),p(2,2),p(0,2)]),true);});
test('crossings, duplicate corners, touching nonadjacent edges and zero-area traces are rejected',()=>{for(const points of [[p(0,0),p(2,2),p(2,0),p(0,2)],[p(0,0),p(1,1),p(0,0)],[p(0,0),p(2,0),p(1,0),p(1,2)],[p(0,0),p(1,1),p(2,2)]])assert.equal(validRoofOutline(points),false);});
test('invalid geographic coordinates are rejected',()=>assert.equal(validRoofOutline([p(0,0),p(1,999),p(2,2)]),false));
test('pitch correction and endpoint rise are calculated independently',()=>{assert.equal(surfaceArea(1000,0),1000);assert.ok(Math.abs(surfaceArea(1000,6)-1118.03398875)<.0001);assert.equal(edgeLength({horizontalFt:3,riseFt:4}),5);});

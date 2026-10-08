import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profitSummary,latestUnanswered} from '../lib/crmTools.ts';
test('profit uses all costs once and margin uses contract value',()=>assert.deepEqual(profitSummary({revenue:10000,materials:3000,labor:2000,disposal:500,other:500}),{costs:6000,profit:4000,margin:40}));
test('cent rounding, losses and zero revenue are handled',()=>{assert.equal(profitSummary({revenue:.3,materials:.1,labor:.2}).profit,0);assert.equal(profitSummary({revenue:100,materials:150}).profit,-50);assert.equal(profitSummary({materials:150}).margin,null);});
test('only latest quote counts; drafts and closed leads are excluded',()=>{const quotes=[{lead_id:'a',status:'Sent',created_at:'2026-01-01'},{lead_id:'a',status:'Draft',created_at:'2026-01-02'},{lead_id:'b',status:'Sent',created_at:'2026-01-01'},{lead_id:'c',status:'Sent',created_at:'2026-01-01'}];assert.deepEqual(latestUnanswered(quotes,new Set(['c']),7,Date.parse('2026-01-10')).map(q=>q.lead_id),['b']);});
test('status change time, not draft creation time, starts reminder aging',()=>{assert.equal(latestUnanswered([{lead_id:'a',status:'Sent',created_at:'2026-01-01',status_updated_at:'2026-01-09'}],new Set(),7,Date.parse('2026-01-10')).length,0);});

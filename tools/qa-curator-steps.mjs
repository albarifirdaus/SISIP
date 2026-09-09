import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/features/curator-studio.js', import.meta.url), 'utf8');
const extract = (name) => {
  const match = source.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  }`));
  assert.ok(match, `Missing ${name}`);
  return match[0];
};
const steps = [];
const summaryContext = { Number };
runInNewContext(`${extract('referenceSummary')}; this.summary = referenceSummary;`, summaryContext);
const summaryValues = {referenceName:'  Kemeja uji  ',referencePrice:'159000',referenceSource:'comootd',referenceColor:'Olive'};
const summaryRow = {querySelector:selector => ({value:summaryValues[selector.match(/name="(.*?)"/)[1]] || ''})};
assert.equal(summaryContext.summary(summaryRow).name, 'Kemeja uji');
assert.match(summaryContext.summary(summaryRow).detail, /Olive.*159.*Dari COMOOTD/);
assert.ok(source.includes('revealInvalidControl(control)'), 'Collapsed invalid fields must be revealed');
assert.ok(source.includes('editor.append(child)'), 'Collapsing must move controls, not recreate them');
const libraryField = {hidden:true};
const variantField = {hidden:true};
const sourceControl = {value:'comootd'};
const sourceRow = {querySelector:selector => selector.includes('referenceSource') ? sourceControl : selector.includes('library-field') ? libraryField : variantField};
const sourceContext = {};
runInNewContext(`${extract('syncReferenceSource')}; this.sync = syncReferenceSource;`, sourceContext);
sourceContext.sync(sourceRow);
assert.equal(libraryField.hidden, false);
assert.equal(variantField.hidden, false);
sourceControl.value = 'own';
sourceContext.sync(sourceRow);
assert.equal(libraryField.hidden, true);
assert.equal(variantField.hidden, true);
assert.match(source, /name="referenceSource"[^]*?<option value="own">Link sendiri<\/option>/);
let invalid = 0;
const context = {
  Number, Boolean,
  validateLookStep: (_form, step) => { steps.push(step); return step !== invalid; },
  showLookStep: (_form, step) => { context.visible = step; },
};
runInNewContext(`${extract('goLookStep')}; this.go = goLookStep;`, context);
context.go({dataset:{currentStep:'1'}}, 3);
assert.deepEqual(steps, [1,2], 'Cannot skip validation by clicking Review');
assert.equal(context.visible, 3);
steps.length = 0;
invalid = 1;
context.visible = 1;
context.go({dataset:{currentStep:'1'}}, 3);
assert.equal(context.visible, 1, 'Invalid concept must prevent review');
assert.deepEqual(steps, [1]);
steps.length = 0;
context.go({dataset:{currentStep:'3'}}, 1);
assert.equal(context.visible, 1);
assert.equal(steps.length, 0, 'Going back should not discard incomplete edits');

let publishCalls = 0;
const submitContext = {
  Number,
  goLookStep: (_form, step) => { submitContext.next = step; },
  validateLookStep: () => false,
  cloud: () => { publishCalls++; return {}; },
};
runInNewContext(`${extract('submitLook')}; this.submit = submitLook;`, submitContext);
await submitContext.submit({dataset:{currentStep:'1'}});
assert.equal(submitContext.next, 2, 'Enter on first step advances rather than publishes');
assert.equal(publishCalls, 0);
await submitContext.submit({dataset:{currentStep:'3'}});
assert.equal(publishCalls, 0, 'Final submission revalidates before calling API');

assert.ok(source.includes('form.prepend(progress, concept, products, review)'), 'Existing inputs and files must be moved, not recreated');
assert.ok(source.includes('novalidate data-curator-look-form'), 'Hidden fields must use step-aware validation');
assert.ok(source.includes('new FileReader()'), 'Local preview must not upload before publish');
assert.ok(source.includes('esc(payload.title)') && source.includes('esc(item.name)'), 'Preview must escape user copy');
console.log('Curator steps QA passed: forward/back, skipped-step guard, Enter, final validation, file preservation structure and escaped preview.');

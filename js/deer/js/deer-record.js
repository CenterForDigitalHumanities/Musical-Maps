/**
 * @module DEER Data Encoding and Exhibition for RERUM
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>
 * @version 0.7
 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

import { DEER, UTILS } from './deer-utils.js'

const changeLoader = new MutationObserver(renderChange)

/**
 * Observer callback for rendering newly loaded objects. Checks the
 * mutationsList for "deep-object" attribute changes.
 * @param {Array} mutationsList of MutationRecord objects
 */
async function renderChange(mutationsList) {
    for (var mutation of mutationsList) {
        switch (mutation.attributeName) {
            case DEER.ID:
                let id = mutation.target.getAttribute(DEER.ID)
                if (id === null) return
                const obj = await getObject(id)
                mutation.target.DeerReport.fillValues(new Map(Object.entries(obj)))
                break
            case DEER.LISTENING:
                let listensTo = mutation.target.getAttribute(DEER.LISTENING)
                if (listensTo) {
                    mutation.target.addEventListener('deer-clicked', e => {
                        let loadId = e.detail["@id"]
                        if (loadId === listensTo) { mutation.target.setAttribute(DEER.ID, loadId) }
                    })
                }
        }
    }
}

async function getObject(findId) {

    let obj = fetch(findId).then(res => res.json())
    let annos = findByTargetId(findId, [], DEER.URLS.QUERY)
    await Promise.all([obj, annos]).then(res => {
        annos = res[1]
        obj = res[0]
    })
    annos.forEach(anno => obj = applyAssertions(obj, anno))

    return obj

    function applyAssertions(assertOn, anno) {
        const annotationBody = anno.body
        if (Array.isArray(annotationBody)) { return annotationBody.forEach(a => applyAssertions(assertOn, a)) }

        const assertions = {}
        Object.entries(annotationBody).forEach(([k, v]) => {
            const assertedValue = UTILS.getValue(v)
            if ([undefined, null, "", [], assertOn[k]].flat().includes(assertedValue)) { return }
            if (assertOn.hasOwnProperty(k) && ![undefined, null, "", []].includes(assertOn[k])) {
                Array.isArray(assertions[k]) ? assertions[k].push(assertedValue).flat() : assertions[k] = [assertOn[k], assertedValue].flat()
            } else {
                assertions[k] = assertedValue
            }
        })
        
        const annotationWithSource = a => ({
            value: a,
            source: {
                citationSource: anno['@id'] || anno.id || "",
                citationNote: "Primitive object from DEER",
                comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/deer"
            }
        })
        
        // Simplify any arrays of length 1, which may not be a good idea.
        Object.entries(assertions).forEach(([k, v]) => { 
            if (Array.isArray(v) && v.length === 1) { assertions[k] = v[0] } 
            assertions[k] = annotationWithSource(assertions[k])
        })
        return Object.assign(assertOn, assertions)
    }

    async function findByTargetId(id, targetStyle = [], queryUrl = DEER.URLS.QUERY) {
        if (!Array.isArray(targetStyle)) {
            targetStyle = [targetStyle]
        }
        targetStyle = targetStyle.concat(["target", "target.@id", "target.id"]) //target.source?
        let historyWildcard = { "$exists": true, "$size": 0 }
        let obj = { "$or": [], "__rerum.history.next": historyWildcard }
        for (let target of targetStyle) {
            if (typeof target === "string") {
                let o = {}
                o[target] = id
                obj["$or"].push(o)
            }
        }
        return fetch(queryUrl + "?limit=100&skip=0", {
            method: "POST",
            body: JSON.stringify(obj),
            headers: {
                "Content-Type": "application/json"
            }
        })
            .then(response => response.json())
            .catch((err) => console.error(err))
    }
}

export default class DeerReport {
    constructor(elem, deer = {}) {


        for (let key in DEER) {
            if (typeof DEER[key] === "string") {
                DEER[key] = deer[key] ?? DEER[key]
            } else {
                DEER[key] = Object.assign(DEER[key], deer[key])
            }
        }
        this.$isDirty = false
        this.id = elem.getAttribute(DEER.ID)
        this.elem = elem
        elem.DeerReport = this
        this.evidence = elem.getAttribute(DEER.EVIDENCE) // inherited to inputs
        this.context = elem.getAttribute(DEER.CONTEXT) // inherited to inputs
        this.attribution = elem.getAttribute(DEER.ATTRIBUTION) // inherited to inputs
        this.motivation = elem.getAttribute(DEER.MOTIVATION) // inherited to inputs
        this.type = elem.getAttribute(DEER.TYPE)
        this.inputs = Array.from(elem.querySelectorAll(DEER.INPUTS.map(s => s + "[" + DEER.KEY + "]").join(",")))
        this.inputs.forEach(inpt => {
            inpt.addEventListener('input', (e) => {
                inpt.$isDirty = true //Make the input dirty
                this.$isDirty = true //Make the DeerReport dirty
            })
        })
        changeLoader.observe(elem, {
            attributes: true
        })
        elem.onsubmit = this.processRecord.bind(this)

        if (this.id) {
            //Do we want to expand for all types?
            UTILS.worker.postMessage({
                action: "view",
                id: this.id
            })
            const submitBtn = this.elem.querySelector('button[type="submit"]')
            if (submitBtn) {
                submitBtn.textContent = submitBtn?.textContent.replace('Create', 'Update')
            }
            UTILS.worker.addEventListener("message", event => {
                this.fillValues(new Map(Object.entries(event.data.payload)))
            })
        } else {
            this.inputs.forEach(inpt => {
                if (inpt.type === "hidden") { inpt.$isDirty = true }
            })
            let listensTo = elem.getAttribute(DEER.LISTENING)
            if (listensTo) {
                window[listensTo].addEventListener?.('click', e => {
                    elem.setAttribute(DEER.ID, e.target.closest(`[${DEER.ID}]`).getAttribute(DEER.ID))
                })
            }

        }
    }

    fillValues(valueMap) {

        if (valueMap.get('@id')) {
            this.id = valueMap.get('@id') ?? valueMap.get('id')
        }
        try {
            const flatKeys = [...new Set(this.inputs.map(input => input.getAttribute(DEER.KEY)))]
            const redundant = this.inputs.length - flatKeys.length
            if (redundant > 0) {
                UTILS.warning(redundant + " duplicate input " + DEER.KEY + " attribute value" + (redundant === 1) ? "" : "s" + " detected in form. Some inputs will be ignored upon form submission and only the first instance will be respected.", this.inputs)
            }
            this.inputs.forEach(elem => UTILS.assertElementValue(elem, Object.fromEntries(valueMap)))
        } catch (err) { console.log(err) }
        setTimeout(function () {
            /*
            *  The difference between a view and a form is that a view does not need to know the annotation data of its sibling views.  
            *  A form needs to know the annotation data of all its child views to populate values, but this hierarchy is not inherent.
            *  
            *  This event works because of deerInitializer.js.  It loads all views in a Promise that uses a timeout
            *  in its resolve state, giving all innerHTML = `something` calls time to make it to the DOM before this event broadcasts.  
            *  You will notice that the "deer-view-rendered" events all happen before this event is fired on respective HTML pages.
            *  This lets the script know forms are open for dynamic rendering interaction, like pre-filling or pre-selecting values.
            */
            UTILS.broadcast(undefined, DEER.EVENTS.FORM_RENDERED, this.elem, Object.fromEntries(valueMap))
        }, 0)
        this.elem.click()
        const submitBtn = this.elem.querySelector('button[type="submit"]')
        if (submitBtn) {
            submitBtn.textContent = submitBtn?.textContent.replace('Create', 'Update')
        }
    }
}
    export function initializeDeerForms(config) {
    const forms = document.querySelectorAll(config.FORM)
    Array.from(forms).forEach(elem => new DeerReport(elem, config))
    document.addEventListener(DEER.EVENTS.NEW_FORM, e => Array.from(e.detail.set).forEach(elem => new DeerReport(elem, config)))
}

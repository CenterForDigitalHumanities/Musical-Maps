/**
 * Base element for rendering an entity in the DOM. The template is a simple <pre> tag with the JSON-LD data rendered in it. 
 * Developers can add their own classes by extending this or add a simpler element with a custom template.
 * 
 * @export default class DeerView
 * @definition {HTMLElement} deer-view
 * @author Patrick Cuba <cubap@slu.edu>
 * @org SLU, Research Computing Group
 */

import { UTILS, DEER } from '/js/deer/js/deer-utils.js'
import '/js/deer/components/templates/default.js'
import DeerView from './view.js'
import {Entity, EntityMap, objectMatch} from '../../js/entities.js'

export default class DeerCollection extends DeerView {
    static get observedAttributes() { return [DEER.ID, DEER.KEY, DEER.LIST, DEER.LINK, DEER.LAZY, DEER.LISTENING]; }
    
    #options = {
        list: this.getAttribute(DEER.LIST),
        link: this.getAttribute(DEER.LINK),
        collection: this.getAttribute(DEER.COLLECTION),
        key: this.getAttribute(DEER.KEY),
        label: this.getAttribute(DEER.LABEL),
        config: DEER
    }
    async #loadCollection() {
        const historyWildcard = { "$exists": true, "$size": 0 }
        const queryObj = {
            $or: [{
                "targetCollection": this.#options.collection
            }, {
                "body.targetCollection": this.#options.collection
            }],
            "__rerum.history.next": historyWildcard
        }
        const pointers = await fetch(DEER.URLS.QUERY, {
            method: "POST",
            mode: "cors",
            headers:{
                "Content-Type": "application/json;charset=utf-8"
            },
            body: JSON.stringify(queryObj)
        })
        .then(response => response.json())
        
        let list = []
        pointers.map(tc => {
            let t = tc.target || tc["@id"] || tc.id
            t = t.replace(/^https?:/,location.protocol)
            list.push(fetch(t).then(response => response.json().catch(err => { __deleted: console.log(err) })))
        })

        const listItems = await Promise.all(list).then(res=>res.filter(i => !i.hasOwnProperty("__deleted")))
        const listObj = {
            id: "dynamic-list-"+this.#options.collection.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0), // quick hash https://stackoverflow.com/users/1568684/lordvlad
            name: this.#options.collection,
            itemListElement: listItems
        }
        try {
            listObj["@type"] = list?.[0]["@type"] ?? list?.[0].type ?? "ItemList"
        } catch (err) { }
        EntityMap.set(listObj.id,listObj)
        this.setAttribute(DEER.ID,listObj.id)
    }

    constructor() {
        super()
        this.#loadCollection()
        this.template = DEER.TEMPLATES[this.getAttribute(DEER.TEMPLATE) ?? 'list']
    }
}

customElements.define(`deer-collection`, DeerCollection)

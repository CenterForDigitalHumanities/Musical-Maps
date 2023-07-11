/**
 * The default templates for rendering objects: entity, list, and prop.
 * Additional tempaltes may be added here or in their own file. Templates 
 * added to the DEER.TEMPLATES object will be available to all components 
 * while custom elements can add their own templates directly.
 * 
 * @author Patrick Cuba <cubap@slu.edu>
 * @organization SLU, Reseach Computing Group
 * @tags templates, deer, rerum
 */
import { default as UTILS } from '../../js/deer-utils.js'
import { default as DEER } from '../../js/deer-config.js'


/**
 * Get a certain property from an object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj containing a key that needs to be drawn
 * @param {String} key the name of the key in the obj we are looking for
 * @param {String} label The label to be displayed when drawn
 */
DEER.TEMPLATES.prop = (obj, options = {}) => {
    try {
        let key = options.key ?? "[ missing key ]"
        let prop = obj[key]
        if(!prop) throw new Error()
        return `<span>${options.label ?? key}: ${UTILS.getValue(prop) ?? `Property <code>${key}</code> is not defined on <a href="${obj.id}" target="_blank">this document</a>`}</span>`
    } catch (err) {
        return null
    }
}

/**
 * Retreive the best label for object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
DEER.TEMPLATES.label = (obj, options = {}) => {
    let prop = obj[options.key] ?? obj.id ?? obj['@id'] ?? "[ undefined ]"
    let label = options.label ?? UTILS.getLabel(obj, prop)
    try {
        if('[ unlabeled ]' === label) throw new Error("inadequate label, no change")
        return `${label}`
    } catch (err) {
        return null
    }
}

/**
 * Render an object expected to containa list.  
 * Consider that this may be changed to a Class component in the future.
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
DEER.TEMPLATES.list = function (obj, options = {}) {
    let tmpl = `<h2>${options.label ?? UTILS.getLabel(obj)}</h2>`
    if (options.list) {
        const entry = (val,name) => options.includeLabel ? `<deer-view ${DEER.ID}="${val["@id"]}" ${DEER.TEMPLATE}="label">${name}</deer-view>` : `${name}`
        tmpl += `<ul>`
        try {
            obj[options.list].forEach((val, index) => {
                let name = UTILS.getLabel(val, (val.type || val['@type'] || index))
                tmpl += (val["@id"] && options.link) ? `<li ${DEER.ID}="${val["@id"]}"><a href="${options.link}${val["@id"]}">${entry(val,name)}</a></li>` : `<li ${DEER.ID}="${val["@id"]}">${entry(val,name)}</li>`
            })
        } catch (meh) { }
        tmpl += `</ul>`
    }
    return tmpl
}

/**
 * Render an object expected to containa list.  
 * Consider that this may be changed to a Class component in the future.
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
DEER.TEMPLATES.labelList = function (obj, options = {}) {
    return DEER.TEMPLATES.list(obj,Object.assign(options,{includeLabel:true}))
}

/**
 * Render an object as an Entity, with description list of properties.  
 * This duplicates the sample Class component in `/view/entity.js` but serves as an example for developers 
 * who want to create their own template without an entire new class. The `deer-template` attribute can be 
 * used on any custom element extending DeerView to specify the template to use.
 * 
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
DEER.TEMPLATES.entity = (obj, options = {}) => {
    let tmpl = `<h2>${options.label ?? UTILS.getLabel(obj)}</h2>`
    let list = ``

    for (let key in obj) {
        if (DEER.SUPPRESS.indexOf(key) > -1) { continue }
        let label = key
        let value = UTILS.getValue(obj[key], key)
        if (value.image?.length > 0) {
            list += (label === "depiction") ? `<img title="${label}" src="${value.image ?? value}" ${DEER.SOURCE}="${UTILS.getValue(obj[key].source, "citationSource")}">` : `<dt ${DEER.SOURCE}="${UTILS.getValue(obj[key].source, "citationSource")}">${label}</dt><dd>${value.image ?? value}</dd>`
            continue
        }
        // is it object/array?
        list += `<dt>${label}</dt>`
        if (Array.isArray(value)) {
            value.filter(undefinedCheck => undefinedCheck !== undefined).forEach((v, index) => list += (v["@id"]) ? `<dd><a href="#${v["@id"]}">${UTILS.getLabel(v, (v.type ?? v['@type'] ?? label + '' + index))}</a></dd>` : `<dd ${DEER.SOURCE}="${UTILS.getValue(v.source, "citationSource")}">${UTILS.getValue(v)}</dd>`)
        } else {
            // a single, probably
            // TODO: export buildValueObject() from UTILS for use here
            if (typeof value === "string") {
                value = {
                    value: value,
                    source: {
                        citationSource: obj['@id'] || obj.id || "",
                        citationNote: "Primitive object from DEER",
                        comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/deer"
                    }
                }
            }
            let v = UTILS.getValue(value)
            if (typeof v === "object") { v = UTILS.getLabel(v) }
            if (v === "[ unlabeled ]") { v = v['@id'] || v.id || "[ complex value unknown ]" }
            list += (value && value['@id']) ? `<dd ${DEER.SOURCE}="${UTILS.getValue(value.source, "citationSource")}"><a href="${options.link || ""}#${value['@id']}">${v}</a></dd>` : `<dd ${DEER.SOURCE}="${UTILS.getValue(value, "citationSource")}">${v}</dd>`
        }
    }
    if (list.includes("</dd>")) { tmpl += `<dl>${list}</dl>` }
    return tmpl
}

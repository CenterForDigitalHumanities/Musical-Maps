/**
 * A hidden input is tracking a select or multi select. It is hidden and it is not a primitive, so DEER does not handle the value.
 * Make sure to set the value of this hidden input.  The value is a string, that string contains a delimiter to join on for cases of multiple values.
 * 
 * @param {Object} expandedEntity Expanded data that is all annotation data for a form.
 * @param {Array(String)} keys The specific annotations we are looking for in expandedEntity. 
 * @param {HTMLElement} form The completely loaded HTML <form> containing the <selects>s
 * @return None
 */
function setTrackedHiddenValues(expandedEntity, keys, form){
    keys.forEach(key =>{
        if(expandedEntity.hasOwnProperty(key)){
            let data_arr = 
            (expandedEntity[key].hasOwnProperty("value") && expandedEntity[key].value.hasOwnProperty("items")) ? expandedEntity[key].value.items : expandedEntity[key].hasOwnProperty("items") ? expandedEntity[key].items : [ getAnnoValue(expandedEntity[key]) ]
            let input = form.querySelector("input[deer-key='"+key+"']")
            //Set the value of the hidden input that tracks this for DEER
            //Check if we need a different delimeter.  The input will tell us.
            let delim = (input.hasAttribute("deer-array-delimeter")) ? input.getAttribute("deer-array-delimeter") : ","
            //Generate the value for the input that DEER supports - "uri,uri..."
            let str_arr = (data_arr.length > 1) ? data_arr.join(delim) : (data_arr.length === 1 ) ? data_arr[0] : ""
            input.value = str_arr
        }

    })
}

function getAnnoValue(property, alsoPeek = [], asType) {
    let prop;
    if (property === undefined || property === "") {
        console.error("Value of property to lookup is missing!")
        return undefined
    }
    if (Array.isArray(property)) {
        // It is an array of things, we can only presume that we want the array.  If it needs to become a string, local functions take on that responsibility.
        return property
    } else {
        if (typeof property === "object") {
            // TODO: JSON-LD insists on "@value", but this is simplified in a lot
            // of contexts. Reading that is ideal in the future.
            if (!Array.isArray(alsoPeek)) {
                alsoPeek = [alsoPeek]
            }
            alsoPeek = alsoPeek.concat(["@value", "value", "$value", "val"])
            for (let k of alsoPeek) {
                if (property.hasOwnProperty(k)) {
                    prop = property[k]
                    break
                } else {
                    prop = property
                }
            }
        } else {
            prop = property
        }
    }
    try {
        switch (asType.toUpperCase()) {
            case "STRING":
                prop = prop.toString();
                break
            case "NUMBER":
                prop = parseFloat(prop);
                break
            case "INTEGER":
                prop = parseInt(prop);
                break
            case "BOOLEAN":
                prop = !Boolean(["false", "no", "0", "", "undefined", "null"].indexOf(String(prop).toLowerCase().trim()));
                break
            default:
        }
    } catch (err) {
        if (asType) {
            throw new Error("asType: '" + asType + "' is not possible.\n" + err.message)
        } else {
            // no casting requested
        }
    } finally {
        return (prop.length === 1) ? prop[0] : prop
    }
}

// function setUserAttributionFields(userInfo){
//     let attributionInputs = ["[deer-key='creator']"] //For annotations that assert a creator
//     let attributionFrameworkElems = ["[deer-creator]"] //For DEER framework elements that have deer-creator (DEER.ATTRIBUTION)
//     attributionInputs.forEach(selector => document.querySelectorAll(selector).forEach(elem => elem.value = "mm-prototype"))
//     document.querySelectorAll(attributionFrameworkElems).forEach(elem => elem.setAttribute("deer-creator", "mm-prototype"))
//     //Populate anything that is supposed to know the username
//     document.querySelectorAll(".theUserName").forEach(elem => elem.innerHTML = "mm-prototype")
// }
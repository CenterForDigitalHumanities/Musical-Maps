import './deer-form.js'

// addEventListener('DOMContentLoaded',loadHashId)
addEventListener('hashchange',loadHashId)

function loadHashId(){
    let hash = location.hash?.substring(1)
    if(!hash){ return }
    const rerumPrefix = "https://devstore.rerum.io/v1/id/"
    if(hash.length===24){ hash = `${rerumPrefix}${hash}`}
    if(!hash.startsWith('http')) { return }
    document.querySelectorAll('[hash-id]').forEach(el=>el.setAttribute('deer-id',hash))
}
if (document.readyState === 'interactive' || 'loaded') loadHashId()

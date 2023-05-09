document.addEventListener('load',loadHashId)


function loadHashId(){
    const hash = location.hash
    if(!hash){ return }
    if(hash.length===24){ hash = `https://devstore.rerum.io/v1/id/${hash}`}
    if(!hash.startsWith('http')) { return }
    document.querySelectorAll('[hash-id]').forEach(el=>el.setAttribute('deer-id',hash))
}
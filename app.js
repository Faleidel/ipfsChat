baseApiUrl = "http://127.0.0.1:5001/api/v0/";

var entityMap = { "&": "&amp;"
                , "<": "&lt;"
                , ">": "&gt;"
                , '"': '&quot;'
                , "'": '&#39;'
                , "/": '&#x2F;'
                };

function escapeHtml(string)
{
    return String(string).replace(/[&<>"'\/]/g, function (s)
    {
        return entityMap[s];
    });
}

function compHotLists( l1 , l2 )
{
    if ( l1.length == 0 )
        return l2;
    if ( l2.length == 0 )
        return [];
    
    var lr = [];
    
    var i = 0;
    var j = 0;
    for (;;)
    {
        var endL1 = i >= l1.length;
        var endL2 = j >= l2.length;
        if ( endL1 )
        {
            for ( ; j < l2.length ; j++ )
                lr.push( l2[j] );
            return lr;
        }
        if ( endL2 )
            return lr;
        
        if ( l1[i].timeStamp == l2[j].timeStamp && l1[i].content == l2[j].content )
        {
            i += 1;
            j += 1;
        }
        else
        {
            if ( l1[i].timeStamp > l2[j].timeStamp )
            {
                i += 1; 
            }
            else
            {
                lr.push( l2[j] );
                j += 1;
            }
        }
    }
}

function timeStamp()
{
    return Date.now();
}

function sortMessages(list)
{
    return list.sort( function(a,b)
    {
        if ( a.timeStamp < b.timeStamp )
            return 1;
        else if ( a.timeStamp > b.timeStamp )
            return -1;
        else
            return 0;
    } );
}

function unsafeConcat(l1,l2)
{
    for (i in l2)
        l1.push(l2[i]);
    return l1
}

function emptyFunction(){}

httpGet = function( url , cont )
{
    var xhReq = new XMLHttpRequest();
    xhReq.open("GET", url, true);
    xhReq.onload = function(e){ console.log(e) ; cont( e.explicitOriginalTarget.responseText , e  ) };
    xhReq.send(null);
}

httpPost = function( url , content , cont )
{
    var xhReq = new XMLHttpRequest();
    xhReq.open("POST", url, true);
    xhReq.onload = function(e){ console.log(e) ; cont( e.explicitOriginalTarget.responseText , e ) };
    
    var c = 'Content-Disposition: file; filename=""\nContent-Type: application/octet-stream\n\n';
    
    var sBoundary = "---------------------------" + Date.now().toString(16);
    xhReq.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + sBoundary);
    xhReq.send("--" + sBoundary + "\r\n" + c + content + "\r\n--" + sBoundary + "--\r\n");
}

function ipfsAdd( content , cont )
{
    httpPost( baseApiUrl + "add" , content , function(r)
    {
        cont( JSON.parse(r).Hash );
    } );
}

function ipfsGet( hash , cont )
{
    httpGet( baseApiUrl + "cat?arg=" + hash , cont );
}

function ipfsResolveName( name , cont )
{
    httpGet( baseApiUrl + "name/resolve?arg=" + name, function(r)
    {
        var hash = JSON.parse(r).Path.split("/")[2];
        cont(hash);
    } );
}

function writeDefaultMessage( cont )
{
    var m = { content : "Conversation Start"
            , parent : ""
            };
    
    ipfsAdd( JSON.stringify(m) , cont );
}

function pointIpnsTo( hash , cont )
{
    console.log( "pointIpnsTo" );
    ipnsStatus.innerHTML = "Updating ipns";
    httpGet( baseApiUrl + "name/publish?arg=" + hash , function(e){ console.log("ipns ok",e) ; ipnsStatus.innerHTML = "Ready" ; cont() ; } );
}

function writeDefaultChatConfig( cont )
{
    writeDefaultMessage( function(defaultMessageHash)
    {
        userChatConfig = { others : []
                         , hotMessages : []
                         , archive : defaultMessageHash
                         , hotMessageAgeLimit : 1000 * 60 * 60
                         , userName : "Anon"
                         };
        
        saveChatconfig( cont );
    } );
}

function saveChatconfig( cont )
{
    ipfsAdd( JSON.stringify( userChatConfig ) , function( configHash )
    {
        pointIpnsTo( configHash , cont );
    } );
}

function addChatMessage( content , cont )
{
    var message = { content : userChatConfig.userName + ": " + content
                  , timeStamp : timeStamp()
                  };
    
    userChatConfig.hotMessages.push( message );
    sortMessages( userChatConfig.hotMessages );
    saveChatconfig( cont );
//    ipfsAdd( JSON.stringify( message ) , function(messageHash)
//    {
//        userChatConfig.hotMessages.push( message );
//        sortMessages( userChatConfig.hotMessages );
//        saveChatconfig( cont );
//    } );
}

function init()
{
    if ( document.location.href.indexOf("api=") != -1 )
        baseApiUrl = document.location.href.split("api=")[1]
    
    chatLogLength = 15;
    
    addInitButtonTo( document.body );
    ipnsStatus = cdiv();
    
    httpGet( baseApiUrl + "config?arg=Identity.PeerID" , function(r)
    {
        userHash = JSON.parse(r).Value;
        console.log("1");
        
        ipfsResolveName( userHash , function(r)
        {
            userPointedHash = r;
            console.log("2");
            
            ipfsGet( userPointedHash , function(r)
            {
                userChatConfig = JSON.parse(r);
                console.log("3");
                
                generateUI();
                var updateTimer = setInterval( update , 1000 * 60 * 2 );
            } );
        } );
    } );
}

function update()
{
    console.log("Updating start");
    ipnsStatus.innerHTML = "Update";
    
    function updateOtherUsers( n )
    {
        var p = userChatConfig.others[n];
        console.log("For other",p);
        
        ipfsResolveName( p.hash , function(p2ConfigHash)
        {
            console.log("Resolved other name");
            ipfsGet( p2ConfigHash , function(p2Config)
            {
                console.log("Got other config");
                var p2Config = JSON.parse( p2Config );
                
                var diff = compHotLists( userChatConfig.hotMessages , p2Config.hotMessages );
                var time = timeStamp();
                var diff = diff.filter( function(e)
                {
                    return (e.timeStamp > time-userChatConfig.hotMessageAgeLimit) && (e.timeStamp < time);
                } );
                
                for ( i in diff )
                    userChatConfig.hotMessages.push( diff[i] );
                sortMessages( userChatConfig.hotMessages );
                
                if ( n >= userChatConfig.others.length - 1 )
                {
                    console.log( "Start archiving" );
                    archiveMessages( function()
                    {
                        saveChatconfig( function(){ getChatLog( setChatContent ) } );
                    } );
                }
                else
                    updateOtherUsers( n+1 );
            } );
        } );
    }
    
    updateOtherUsers( 0 );
}

function archiveMessages( cont )
{
    if ( userChatConfig.hotMessages.length == 0 )
        cont();
    else
    {
        var lm = userChatConfig.hotMessages[ userChatConfig.hotMessages.length-1 ];
        
        if ( lm.timeStamp < timeStamp() - userChatConfig.hotMessageAgeLimit )
        {
            var message = userChatConfig.hotMessages.splice( userChatConfig.hotMessages.length-1 , 1 )[0];
            message.parent = userChatConfig.archive;
            
            ipfsAdd( JSON.stringify( message ) , function(mHash)
            {
                userChatConfig.archive = mHash;
                archiveMessages( cont );
            } );
        }
        else
            saveChatconfig( cont );
    }
}

function ce(p)
{
    return document.createElement(p);
}

function cdiv()
{
    return ce("div");
}

function onEnter(el,cont)
{
    el.onkeypress = function(e)
    {
        if (!e) e = window.event;
        var keyCode = e.keyCode || e.which;
        if (keyCode == '13')
        {
            cont();
            return false;
        }
    };
}

function addDivTo( e )
{
    var d = cdiv();
    e.appendChild(d);
    return d;
}

function addETo( st , e )
{
    var d = ce( st );
    e.appendChild( d );
    return d;
}

function addInitButtonTo( e )
{
    var initButton = addETo( "button" , e );
    initButton.innerHTML = "Init";
    initButton.onclick = function()
    {
        document.body.innerHTML = "Writing to your ipns can take some time. Please refresh the page in a minute.";
        writeDefaultChatConfig(emptyFunction);
    };
}


function generateUI()
{
    document.body.innerHTML = "";
    
    uiHead = addDivTo( document.body );
    
    addInitButtonTo( uiHead );
    
    userHashBox = addDivTo( uiHead );
    userHashBox.innerHTML = "Your id is: " + userHash;
    
    ipnsStatus = addDivTo( uiHead );
    ipnsStatus.innerHTML = "Ready";
    
    userNameBox = addDivTo( uiHead );
    
    userNameBoxText = addDivTo( userNameBox );
    userNameBoxText.innerHTML = "User name (press enter to submit):";
    
    userNameInput = addETo( "input" , userNameBox );
    userNameInput.value = userChatConfig.userName;
    onEnter( userNameInput , function()
    {
        userChatConfig.userName = userNameInput.value;
        saveChatconfig(emptyFunction);
    } );
    
    addOtherBox = addDivTo( uiHead );
    
    addOtherText = addDivTo( addOtherBox );
    addOtherText.innerHTML = "Add other person (press enter to submit):";
    
    addOtherInput = addETo( "input" , addOtherBox );
    onEnter( addOtherInput , function()
    {
        userChatConfig.others.push( { hash : addOtherInput.value , lastHead : "" } );
        addOtherInput.value = "";
        saveChatconfig(emptyFunction);
    } );
    
    chatLengthDiv = addETo( "div" , uiHead );
    chatLengthText = addETo( "div" , chatLengthDiv );
    chatLengthText.innerHTML = "Chat size";
    chatLengthInput = addETo( "input" , chatLengthDiv );
    chatLengthInput.value = chatLogLength;
    onEnter( chatLengthInput , function()
    {
        chatLogLength = parseInt( chatLengthInput.value );
        getChatLog( setChatContent );
    } );
    
    forceUpdate = addETo( "button" , uiHead );
    forceUpdate.innerHTML = "Force update";
    forceUpdate.onclick = function()
    {
        update();
    };
    
    getChatLog( function(chatLog)
    {
        chatContainer = cdiv();
        setChatContent( chatLog );
        document.body.appendChild( chatContainer );
        
        addMessageBox = { div : cdiv()
                        , input : ce("input")
                        , button : ce("button")
                        };
        
        onEnter( addMessageBox.input , function()
        {
            var content = addMessageBox.input.value;
            
            if ( content != "" )
            {
                addMessageBox.input.value = "";
                addChatMessage( content , function()
                {
                    getChatLog( setChatContent );
                } );
            }
        } );
        
        addMessageBox.div.appendChild( addMessageBox.input );
        addMessageBox.div.appendChild( addMessageBox.button );
        
        addMessageBox.button.innerHTML = "send";
        addMessageBox.button.onclick = function(e)
        {
            var content = addMessageBox.input.value;
            
            if ( content != "" )
            {
                addMessageBox.input.value = "";
                addChatMessage( content , function()
                {
                    getChatLog( setChatContent );
                } );
            }
        };
        
        document.body.appendChild( addMessageBox.div );
    } );
}

function setChatContent( chatLog )
{
    chatContainer.innerHTML = "";
    
    for ( var i = chatLog.length-1 ; i >= 0 ; i-- )
    {
        var message = ce("pre");
        message.innerHTML = escapeHtml( chatLog[i].content );
        chatContainer.appendChild(message);
    }
}

function getChatLog( cont )
{
    var log = JSON.parse( JSON.stringify( userChatConfig.hotMessages ) );
    if ( log.length < chatLogLength )
    {
        var l = chatLogLength - log.length;
        getChatLogArchive( userChatConfig.archive , l , function(log2)
        {
            for ( i in log2 )
                log.push( log2[i] );
            cont( log );
        } );
    }
    else
        return cont( log );
}

function getChatLogArchive( startHash , num , cont )
{
    if (!startHash || num == 0)
        cont([]);
    else
    {
        function loop( hash , list , num , funct , cont )
        {
            ipfsGet( hash , function(r)
            {
                var message = JSON.parse(r);
                
                list.push(message);
                
                if (!message.parent || num == 0)
                    cont( list );
                else
                    funct( message.parent , list , num-1 , funct , cont );
            } );
        }
        
        loop( startHash , [] , num , loop , cont );
    }
}

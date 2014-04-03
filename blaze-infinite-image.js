Images = new Meteor.Collection('images');

if (Meteor.isClient) {

  number_of_loaded_images = 4;
  Session.setDefault('imagesTotal', '*calculating*');
  Session.setDefault('number_of_visible_images', 5);
  Session.setDefault('skip',0);

  Template.hello.greeting = function () {
    return "Currently there are "+number_of_loaded_images+" of <span class=imagesTotal>"+Session.get('imagesTotal')+"</span> loaded in the collection (skip "+Session.get('skip')+')';
  };

  Template.hello.events({
    'click span.imagesTotal':function(e,t) {
      Meteor.call('getSomeImages', function(err, result){
        Session.set("imagesTotal", result);
      });
    }
  })

  Template.endless.images = function() {
    return Images.find();
  };

  Template.endless.rendered = function() {
    console.log('endless rendered');
    var $w = $(window);
    $w.on('scroll', function(){
      var skip = Session.get('skip');
      var b = $('#bottom').offset().top - $w.scrollTop() - $w.height();
      var t = $('#top').offset().top - $w.scrollTop();
      if(b <= 0)
      {
        Session.set('skip', skip+1);
        Session.set('mode', 'append');
      }
      if(t >= 8) 
      {
        if(skip > 0)
        {
          Session.set('mode', 'prepend');
          Session.set('skip', skip-1);
        }
      }
    })
  };

  Template.image.rendered = function() {
    var id = this.$('li.item').attr('id');
    var $w = $(window);
    console.log('image rendered '+id);
    if(Session.equals('mode','prepend'))
    {
      var t = $('#top').offset().top - $w.scrollTop();
      $w.scrollTop(1);
      $('#endless').prepend($('#'+id));
    }
    else
    {
      $w.scrollTop($w.scrollTop()-1);      
    }
  };

  Template.image.events({
    'click img': function(e, t) {
      var $i = $(e.target).parent();
      var id = $i.attr('id');
        Images.remove({_id: id});
        Meteor.call('imagesTotal', function(err, result){
          Session.set("imagesTotal", result);
        });        
    }
  })

  Meteor.startup(function(){
    Meteor.call('imagesTotal', function(err, result){
      Session.set("imagesTotal", result);
    });
  });

  Deps.autorun(function(){
    Meteor.subscribe('images', number_of_loaded_images, Session.get('skip'), {
      onError: function(){
        console.log('subscription error');
      },
      onReady: function() {
        console.log('subscription ready');
      }
    });
  });
}

if (Meteor.isServer) {
  //
  // this is the function from the feed we need to provide to
  // process the feed images
  //
  var total;
  function jsonFlickrFeed(a)
  {
    console.log('jsonFlickrFeed '+a.items.length);
    var e = {};
    var n = 1;
    // get existing images to avoid duplicates
    Images.find({},{sort:{n:1}}).forEach(function(i){
      e[i.url] = i;
      n = i.n;
    });
    // now iterate over the the feed
    _.each(a.items, function(i) {
      var url = i.media.m;
      if(url in e)
      {
        console.log(url+' exists');
      }
      else
      {
        Images.insert({url: url,n: ++n});
        e[url] = i;
      }
    });
  };

  function getSomeImages()
  {
    //
    // get images from flickr
    // wget -O - "https://api.flickr.com/services/feeds/photos_public.gne?format=json&id=118281683@N02"
    //
    HTTP.get("https://api.flickr.com/services/feeds/photos_public.gne?format=json", function(error, result){
      if(error)
      {
        console.log(error);
      }
      else eval(result.content);
    });
  };

  Meteor.startup(function () {
    // code to run on server at startup
    if( !Images.findOne() )
    {
      getSomeImages();
    }
  });

  Meteor.publish('images', function(limit, skip){
    skip = skip == undefined ? 0 : skip;
    limit = limit == undefined ? 3 : limit;
    return Images.find({},{limit: limit,skip: skip, sort: {n: 1}});
  });
}

Meteor.methods({
  imagesTotal: function(v) {
    if(this.isSimulation)
    {
      // this runs on the client
      // the return value will be in the result parameter of the async callback
      Session.set("imagesTotal", "how many images total");
      return "counting images";
    }
    else
    {
      // the return value will be in the result parameter of the async callback
      return Images.find().count();
    }
  },
  getSomeImages: function() {
    if(this.isSimulation)
    {
      return "getting some images";
    }
    else
    {
      getSomeImages();
      return Images.find().count();
    }
  }
});

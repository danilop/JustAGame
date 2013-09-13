### JustAGame

A (very) simple game to showcase the power of [HTML5](http://en.wikipedia.org/wiki/HTML5) + [WebSockets](http://en.wikipedia.org/wiki/WebSocket)
and the use of [Amazon Web Services (AWS)](http://aws.amazon.com) [APIs](http://aws.amazon.com/code) within an application.

It is based on the [mozilla-festival](https://github.com/robhawkes/mozilla-festival) repository by [Rob Hawkes](http://rawkes.com) ([@robhawkes](https://twitter.com/robhawkes)).

The server side code is written in [Node.js](http://nodejs.org) with [Socket.IO](http://socket.io).

I used the [AWS SDK for Node.js](http://aws.amazon.com/sdkfornodejs/)
to log client connections/disconnections in an [Amazon Simple Queue Service (SQS)](http://aws.amazon.com/sqs/).

The game is using WebSockets for bidirectional communication between clients (i.e. browsers) and server.
I used [Redis](http://redis.io) (managed by [ElastiCache](http://aws.amazon.com/elasticache)) for session data.

This is a work-in-progress as I'm going to add other sample features in the (near?) future.

The latest version is currently deployed here (I used [AWS Elastic Beanstalk](http://aws.amazon.com/elasticbeanstalk/)):

http://justagame.elasticbeanstalk.com

Any feedback is welcome! :)

### License

Copyright (c) 2013 Danilo Poccia, http://blog.danilopoccia.net

This code is licensed under the The MIT License (MIT). Please see the LICENSE file that accompanies this project for the terms of use.


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/danilop/justagame/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

